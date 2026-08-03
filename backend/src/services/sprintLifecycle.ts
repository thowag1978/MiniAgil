import { ItemHistoryEvent, SprintStatus } from '@prisma/client';
import { prisma } from '../infrastructure/db';
import { recordItemHistory } from './itemHistory';
import { captureInitialSprintScope, createSprintSnapshot, recordSprintScopeChange } from './sprintMetrics';
import { publishDomainEvent } from './domainEventOutbox';

export class SprintLifecycleError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
type PendingDestination = 'BACKLOG' | 'SPRINT';

export async function startSprint(sprintId: string, userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const sprint = await tx.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new SprintLifecycleError(404, 'Sprint not found');
    await tx.$queryRaw`SELECT id FROM projects WHERE id = ${sprint.project_id} FOR UPDATE`;
    if (sprint.status !== SprintStatus.PLANNED) throw new SprintLifecycleError(400, 'Only planned sprints can be started');
    if (!sprint.startDate || !sprint.endDate || sprint.endDate < sprint.startDate) throw new SprintLifecycleError(400, 'Starting a sprint requires valid start and end dates');
    const active = await tx.sprint.findFirst({ where: { project_id: sprint.project_id, status: SprintStatus.ACTIVE, id: { not: sprint.id } }, select: { id: true } });
    if (active) throw new SprintLifecycleError(409, 'Project already has an active sprint');
    const startedAt = new Date();
    await captureInitialSprintScope(tx, sprint.id, startedAt);
    return tx.sprint.update({ where: { id: sprint.id }, data: { status: SprintStatus.ACTIVE, startedAt, started_by_id: userId } });
  });
  await publishDomainEvent({ eventType: 'SPRINT_STARTED', actor: { id: userId }, project: { id: result.project_id }, entity: { type: 'SPRINT', id: result.id }, payload: { name: result.name } });
  return result;
}

export async function finishSprint(input: { sprintId: string; userId: string; pendingDestination: PendingDestination; targetSprintId?: string }) {
  if (!['BACKLOG', 'SPRINT'].includes(input.pendingDestination)) throw new SprintLifecycleError(400, 'A pending item destination is required');
  const result = await prisma.$transaction(async (tx) => {
    const sprint = await tx.sprint.findUnique({ where: { id: input.sprintId } });
    if (!sprint) throw new SprintLifecycleError(404, 'Sprint not found');
    await tx.$queryRaw`SELECT id FROM sprints WHERE id = ${sprint.id} FOR UPDATE`;
    if (sprint.status !== SprintStatus.ACTIVE) throw new SprintLifecycleError(400, 'Only active sprints can be finished');
    let target: { id: string; name: string } | null = null;
    if (input.pendingDestination === 'SPRINT') {
      if (!input.targetSprintId || input.targetSprintId === sprint.id) throw new SprintLifecycleError(400, 'A different planned target sprint is required');
      target = await tx.sprint.findFirst({ where: { id: input.targetSprintId, project_id: sprint.project_id, status: SprintStatus.PLANNED }, select: { id: true, name: true } });
      if (!target) throw new SprintLifecycleError(400, 'Target sprint must be planned and belong to the same project');
    }
    const pending = await tx.item.findMany({
      where: { sprint_id: sprint.id, workflow_status: { category: { not: 'DONE' } } },
      select: { id: true, project_id: true, project_key: true, title: true, story_points: true, type: true },
    });
    for (const item of pending) {
      if (item.type === 'STORY') await recordSprintScopeChange(tx, { sprintId: sprint.id, userId: input.userId, item, changeType: 'REMOVED', reason: 'SPRINT_FINISHED' });
      await tx.item.update({ where: { id: item.id }, data: { sprint_id: target?.id ?? null } });
      await recordItemHistory(tx, {
        itemId: item.id, projectId: item.project_id, userId: input.userId,
        eventType: ItemHistoryEvent.SPRINT_CHANGED, field: 'sprint_id',
        oldValue: { id: sprint.id, name: sprint.name },
        newValue: target ? { id: target.id, name: target.name } : { id: null, name: null },
        metadata: { reason: 'SPRINT_FINISHED' },
      });
    }
    await createSprintSnapshot(tx, sprint.id);
    const updated = await tx.sprint.update({ where: { id: sprint.id }, data: { status: SprintStatus.FINISHED, finishedAt: new Date(), finished_by_id: input.userId } });
    return { sprint: updated, movedItems: pending.length };
  });
  await publishDomainEvent({ eventType: 'SPRINT_FINISHED', actor: { id: input.userId }, project: { id: result.sprint.project_id }, entity: { type: 'SPRINT', id: result.sprint.id }, payload: { name: result.sprint.name, movedItems: result.movedItems } });
  return result;
}

export async function cancelSprint(sprintId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const sprint = await tx.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new SprintLifecycleError(404, 'Sprint not found');
    await tx.$queryRaw`SELECT id FROM sprints WHERE id = ${sprint.id} FOR UPDATE`;
    if (sprint.status === SprintStatus.FINISHED || sprint.status === SprintStatus.CANCELLED) throw new SprintLifecycleError(400, 'Finished or cancelled sprints cannot be cancelled again');
    const items = await tx.item.findMany({ where: { sprint_id: sprint.id }, select: { id: true, project_id: true, project_key: true, title: true, story_points: true, type: true } });
    for (const item of items) {
      if (sprint.status === SprintStatus.ACTIVE && item.type === 'STORY') await recordSprintScopeChange(tx, { sprintId: sprint.id, userId, item, changeType: 'REMOVED', reason: 'SPRINT_CANCELLED' });
      await tx.item.update({ where: { id: item.id }, data: { sprint_id: null } });
      await recordItemHistory(tx, { itemId: item.id, projectId: item.project_id, userId, eventType: ItemHistoryEvent.SPRINT_CHANGED, field: 'sprint_id', oldValue: { id: sprint.id, name: sprint.name }, newValue: { id: null, name: null }, metadata: { reason: 'SPRINT_CANCELLED' } });
    }
    if (sprint.status === SprintStatus.ACTIVE) await createSprintSnapshot(tx, sprint.id);
    return tx.sprint.update({ where: { id: sprint.id }, data: { status: SprintStatus.CANCELLED, finishedAt: new Date(), finished_by_id: userId } });
  });
}
