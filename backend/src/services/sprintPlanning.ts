import { ItemHistoryEvent } from '@prisma/client';
import { prisma } from '../infrastructure/db';
import { recordItemHistory } from './itemHistory';
import { createSprintSnapshot, recordSprintScopeChange } from './sprintMetrics';

export class SprintPlanningError extends Error { constructor(public statusCode: number, message: string) { super(message); } }

export async function addStoryToSprint(input: { sprintId: string; itemId: string; userId: string }) {
  return changeStorySprint({ ...input, add: true });
}

export async function removeStoryFromSprint(input: { sprintId: string; itemId: string; userId: string }) {
  return changeStorySprint({ ...input, add: false });
}

async function changeStorySprint(input: { sprintId: string; itemId: string; userId: string; add: boolean }) {
  const [sprint, story] = await Promise.all([
    prisma.sprint.findUnique({ where: { id: input.sprintId }, select: { id: true, name: true, project_id: true, status: true } }),
    prisma.item.findUnique({ where: { id: input.itemId }, select: { id: true, project_key: true, title: true, story_points: true, type: true, project_id: true, sprint: { select: { id: true, name: true } } } }),
  ]);
  if (!sprint) throw new SprintPlanningError(404, 'Sprint not found');
  if (!story) throw new SprintPlanningError(404, 'Item not found');
  if (story.type !== 'STORY') throw new SprintPlanningError(400, 'Only STORY items can be planned in a sprint');
  if (story.project_id !== sprint.project_id) throw new SprintPlanningError(400, 'Item and sprint must belong to the same project');
  if (sprint.status === 'FINISHED' || sprint.status === 'CANCELLED') throw new SprintPlanningError(400, 'Finished or cancelled sprints cannot be replanned');
  if (input.add && story.sprint?.id === sprint.id) return story;
  if (input.add && story.sprint) throw new SprintPlanningError(409, 'Story already belongs to another sprint');
  if (!input.add && story.sprint?.id !== sprint.id) throw new SprintPlanningError(400, 'Story does not belong to the selected sprint');

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM items WHERE id = ${story.id} FOR UPDATE`;
    const updated = await tx.item.update({
      where: { id: story.id }, data: { sprint_id: input.add ? sprint.id : null },
      include: { sprint: true, assignee: true, parent: true, workflow_status: true },
    });
    await recordItemHistory(tx, {
      itemId: story.id, projectId: story.project_id, userId: input.userId,
      eventType: ItemHistoryEvent.SPRINT_CHANGED, field: 'sprint_id',
      oldValue: story.sprint ? { id: story.sprint.id, name: story.sprint.name } : { id: null, name: null },
      newValue: input.add ? { id: sprint.id, name: sprint.name } : { id: null, name: null },
    });
    if (sprint.status === 'ACTIVE') {
      await recordSprintScopeChange(tx, { sprintId: sprint.id, userId: input.userId, item: story, changeType: input.add ? 'ADDED' : 'REMOVED', reason: input.add ? 'SPRINT_PLANNING' : 'BACKLOG_RETURN' });
      await createSprintSnapshot(tx, sprint.id);
    }
    return updated;
  });
}
