import { BugEnvironment, BugRetestResult, ItemHistoryEvent, Prisma, WorkflowCategory } from '@prisma/client';
import { prisma } from '../infrastructure/db';
import { recordItemHistory } from './itemHistory';
import { publishDomainEvent } from '../infrastructure/domainEvents';
import { validateWorkflowTransition, WorkflowTransitionError } from './workflowTransitions';

export class BugRetestError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

const retestInclude = {
  tester: { select: { id: true, name: true, email: true } },
} satisfies Prisma.BugRetestInclude;

export async function listBugRetests(bugId: string) {
  return prisma.bugRetest.findMany({ where: { bug_id: bugId }, include: retestInclude, orderBy: { createdAt: 'desc' } });
}

export async function createBugRetest(input: {
  bugId: string;
  testerId: string;
  environment: BugEnvironment;
  result: BugRetestResult;
  observations?: string | null;
  targetStatusId?: string;
}) {
  const bug = await prisma.item.findUnique({
    where: { id: input.bugId },
    select: {
      id: true, type: true, project_id: true, assignee_id: true,
      workflow_status: { select: { id: true, name: true, workflow_id: true } },
      bug_details: { select: { reopened_count: true } },
    },
  });
  if (!bug) throw new BugRetestError(404, 'Bug not found');
  if (bug.type !== 'BUG') throw new BugRetestError(400, 'Only BUG items can receive retests');

  let targetStatus: { id: string; name: string; category: WorkflowCategory; workflow_id: string | null; is_active: boolean } | null = null;
  if (input.result === BugRetestResult.FAILED && !input.targetStatusId) {
    throw new BugRetestError(400, 'Failed retests require a reopen target status');
  }
  if (input.targetStatusId) {
    targetStatus = await prisma.workflowStatus.findUnique({
      where: { id: input.targetStatusId },
      select: { id: true, name: true, category: true, workflow_id: true, is_active: true },
    });
    if (!targetStatus?.workflow_id || !targetStatus.is_active || targetStatus.workflow_id !== bug.workflow_status.workflow_id) {
      throw new BugRetestError(400, 'Target status is not active or does not belong to this bug workflow');
    }
    if (input.result === BugRetestResult.FAILED && targetStatus.category !== WorkflowCategory.IN_PROGRESS) {
      throw new BugRetestError(400, 'Failed retests must return the bug to an in-progress status');
    }
    if (input.result === BugRetestResult.FAILED && targetStatus.id === bug.workflow_status.id) {
      throw new BugRetestError(400, 'Failed retests must reopen the bug in another status');
    }
    if (input.result === BugRetestResult.APPROVED && targetStatus.category !== WorkflowCategory.DONE) {
      throw new BugRetestError(400, 'Approved retests can only move the bug to a done status');
    }
    if (input.result !== BugRetestResult.FAILED && input.result !== BugRetestResult.APPROVED) {
      throw new BugRetestError(400, 'This retest result cannot change the bug status');
    }
    try {
      await validateWorkflowTransition({
        workflowId: targetStatus.workflow_id,
        fromStatusId: bug.workflow_status.id,
        toStatusId: targetStatus.id,
        projectId: bug.project_id,
        userId: input.testerId,
        assigneeId: bug.assignee_id,
        ...(input.observations ? { comment: input.observations } : {}),
      });
    } catch (error) {
      if (error instanceof WorkflowTransitionError) throw new BugRetestError(400, error.message);
      throw error;
    }
  }

  const retest = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM items WHERE id = ${bug.id} FOR UPDATE`;
    const retest = await tx.bugRetest.create({
      data: {
        bug_id: bug.id, tester_id: input.testerId, environment: input.environment,
        result: input.result, observations: input.observations || null,
      },
      include: retestInclude,
    });

    await recordItemHistory(tx, {
      itemId: bug.id, projectId: bug.project_id, userId: input.testerId,
      eventType: ItemHistoryEvent.BUG_RETEST_RECORDED, field: 'retest',
      newValue: { result: input.result, environment: input.environment },
      metadata: { retest_id: retest.id, observations: input.observations || null },
    });

    if (targetStatus && targetStatus.id !== bug.workflow_status.id) {
      await tx.item.update({ where: { id: bug.id }, data: { workflow_status_id: targetStatus.id } });
      await recordItemHistory(tx, {
        itemId: bug.id, projectId: bug.project_id, userId: input.testerId,
        eventType: ItemHistoryEvent.STATUS_CHANGED, field: 'workflow_status_id',
        oldValue: { id: bug.workflow_status.id, name: bug.workflow_status.name },
        newValue: { id: targetStatus.id, name: targetStatus.name },
      });
    }

    if (input.result === BugRetestResult.FAILED) {
      const details = await tx.bugDetails.upsert({
        where: { item_id: bug.id },
        create: { item_id: bug.id, reopened_count: 1 },
        update: { reopened_count: { increment: 1 } },
        select: { reopened_count: true },
      });
      await recordItemHistory(tx, {
        itemId: bug.id, projectId: bug.project_id, userId: input.testerId,
        eventType: ItemHistoryEvent.BUG_REOPENED, field: 'reopened_count',
        oldValue: { value: bug.bug_details?.reopened_count ?? 0 },
        newValue: { value: details.reopened_count },
        metadata: { retest_id: retest.id },
      });
    }
    return retest;
  });
  if (input.result === BugRetestResult.FAILED) await publishDomainEvent({ eventType: 'BUG_REOPENED', actor: { id: input.testerId }, project: { id: bug.project_id }, entity: { type: 'BUG', id: bug.id }, payload: { retestId: retest.id, environment: input.environment } });
  return retest;
}
