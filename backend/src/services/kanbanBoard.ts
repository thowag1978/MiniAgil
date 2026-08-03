import { ItemHistoryEvent, Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/db';
import { recordCommentHistory, recordItemChanges } from './itemHistory';
import { validateWorkflowTransition, WorkflowTransitionError } from './workflowTransitions';
import { publishDomainEvent } from '../infrastructure/domainEvents';

const POSITION_STEP = 1024;
const MIN_POSITION_GAP = 0.001;

export class KanbanMoveError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const historySelect = {
  id: true, type: true, project_id: true, title: true, description: true, priority: true,
  estimate: true, story_points: true, acceptance_criteria: true, board_position: true, updatedAt: true,
  workflow_status: { select: { id: true, name: true, workflow_id: true } },
  assignee: { select: { id: true, name: true } },
  sprint: { select: { id: true, name: true } },
} satisfies Prisma.ItemSelect;

export async function moveKanbanItem(input: {
  itemId: string;
  targetStatusId: string;
  targetIndex: number;
  userId: string;
  expectedUpdatedAt?: string;
  transitionComment?: string;
}) {
  const before = await prisma.item.findUnique({ where: { id: input.itemId }, select: historySelect });
  if (!before) throw new KanbanMoveError(404, 'Item not found');

  const targetStatus = await prisma.workflowStatus.findUnique({
    where: { id: input.targetStatusId },
    select: { id: true, name: true, workflow_id: true, is_active: true, wip_limit: true, workflow: { select: { project_id: true, item_type: true } } },
  });
  if (!targetStatus?.workflow_id || !targetStatus.workflow || targetStatus.is_active === false
    || targetStatus.workflow.project_id !== before.project_id || targetStatus.workflow.item_type !== before.type
    || targetStatus.workflow_id !== before.workflow_status.workflow_id) {
    throw new KanbanMoveError(400, 'Target status must belong to the item workflow and project');
  }

  let transition = null;
  if (before.workflow_status.id !== targetStatus.id) {
    try {
      transition = await validateWorkflowTransition({
        workflowId: targetStatus.workflow_id,
        fromStatusId: before.workflow_status.id,
        toStatusId: targetStatus.id,
        projectId: before.project_id,
        userId: input.userId,
        assigneeId: before.assignee?.id ?? null,
        ...(input.transitionComment === undefined ? {} : { comment: input.transitionComment }),
      });
    } catch (error) {
      if (error instanceof WorkflowTransitionError) throw new KanbanMoveError(400, error.message);
      throw error;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM items WHERE id = ${input.itemId} FOR UPDATE`;
    const locked = await tx.item.findUnique({ where: { id: input.itemId }, select: { updatedAt: true } });
    if (!locked) throw new KanbanMoveError(404, 'Item not found');
    if (input.expectedUpdatedAt && locked.updatedAt.toISOString() !== new Date(input.expectedUpdatedAt).toISOString()) {
      throw new KanbanMoveError(409, 'Item was changed by another operation. Reload the board and try again');
    }

    const destinationItems = await tx.item.findMany({
      where: { workflow_status_id: targetStatus.id, id: { not: input.itemId } },
      select: { id: true, board_position: true },
      orderBy: [{ board_position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    if (!Number.isInteger(input.targetIndex) || input.targetIndex < 0 || input.targetIndex > destinationItems.length) {
      throw new KanbanMoveError(400, 'target_index is outside the destination column');
    }

    let positions = destinationItems.map(({ board_position }) => board_position);
    const previous = positions[input.targetIndex - 1];
    const next = positions[input.targetIndex];
    if (previous !== undefined && next !== undefined && next - previous <= MIN_POSITION_GAP) {
      await Promise.all(destinationItems.map((item, index) => tx.item.update({
        where: { id: item.id }, data: { board_position: (index + 1) * POSITION_STEP },
      })));
      positions = destinationItems.map((_, index) => (index + 1) * POSITION_STEP);
    }

    const normalizedPrevious = positions[input.targetIndex - 1];
    const normalizedNext = positions[input.targetIndex];
    const boardPosition = normalizedPrevious === undefined
      ? (normalizedNext === undefined ? POSITION_STEP : normalizedNext - POSITION_STEP)
      : (normalizedNext === undefined ? normalizedPrevious + POSITION_STEP : (normalizedPrevious + normalizedNext) / 2);

    const updated = await tx.item.update({
      where: { id: input.itemId },
      data: {
        board_position: boardPosition,
        ...(before.workflow_status.id === targetStatus.id ? {} : { workflow_status_id: targetStatus.id }),
      },
      include: {
        workflow_status: true, assignee: true, sprint: true, bug_details: true,
        parent: { select: { id: true, title: true, project_key: true, type: true } },
        children: { select: { id: true, title: true, project_key: true, type: true, workflow_status: true } },
      },
    });
    await recordItemChanges(tx, before, updated, input.userId);

    if (transition?.requires_comment) {
      const comment = await tx.comment.create({
        data: { text: String(input.transitionComment).trim(), user_id: input.userId, item_id: input.itemId },
      });
      await recordCommentHistory(tx, {
        itemId: input.itemId, projectId: before.project_id, userId: input.userId,
        commentId: comment.id, eventType: ItemHistoryEvent.COMMENT_CREATED, newText: comment.text,
      });
    }

    const count = await tx.item.count({ where: { workflow_status_id: targetStatus.id } });
    const exceeded = targetStatus.wip_limit !== null && count > targetStatus.wip_limit;
    return {
      item: updated,
      column: { status_id: targetStatus.id, count, wip_limit: targetStatus.wip_limit, exceeded },
      warnings: exceeded ? [{ code: 'WIP_LIMIT_EXCEEDED', message: `WIP limit exceeded: ${count}/${targetStatus.wip_limit}` }] : [],
    };
  });
  await publishDomainEvent({ eventType: 'ITEM_UPDATED', actor: { id: input.userId }, project: { id: before.project_id }, entity: { type: 'ITEM', id: before.id }, payload: { changedFields: ['board_position', ...(before.workflow_status.id === targetStatus.id ? [] : ['workflow_status_id'])] } });
  if (before.workflow_status.id !== targetStatus.id) await publishDomainEvent({ eventType: 'ITEM_STATUS_CHANGED', actor: { id: input.userId }, project: { id: before.project_id }, entity: { type: 'ITEM', id: before.id }, payload: { fromStatusId: before.workflow_status.id, toStatusId: targetStatus.id } });
  return result;
}
