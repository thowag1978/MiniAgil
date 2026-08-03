import { Prisma, SprintScopeChangeType, SprintStatus } from '@prisma/client';
import { prisma } from '../infrastructure/db';

type DbClient = Prisma.TransactionClient;
type ScopeItem = { id: string; project_key: string; title: string; story_points: number | null };

export const UNESTIMATED_STORY_FALLBACK_POINTS = 1;
export const SPRINT_COMPLETION_CRITERION = 'A story is complete when its workflow status category is DONE.';

const pointsFor = (storyPoints: number | null) => storyPoints ?? UNESTIMATED_STORY_FALLBACK_POINTS;
const day = (value = new Date()) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

function dailySeries<T extends { id: string; snapshot_date: Date }>(snapshots: T[], until: Date) {
  if (!snapshots.length) return snapshots;
  const byDate = new Map(snapshots.map((snapshot) => [day(snapshot.snapshot_date).toISOString(), snapshot]));
  const result: T[] = [];
  let last = snapshots[0]!;
  for (let cursor = day(last.snapshot_date); cursor <= day(until); cursor = new Date(cursor.getTime() + 86_400_000)) {
    last = byDate.get(cursor.toISOString()) ?? last;
    result.push({ ...last, id: byDate.has(cursor.toISOString()) ? last.id : `daily-${cursor.toISOString().slice(0, 10)}`, snapshot_date: cursor });
  }
  return result;
}

export async function captureInitialSprintScope(tx: DbClient, sprintId: string, capturedAt = new Date()) {
  const stories = await tx.item.findMany({
    where: { sprint_id: sprintId, type: 'STORY' },
    select: { story_points: true, workflow_status: { select: { category: true } } },
  });
  const scopePoints = stories.reduce((total, story) => total + pointsFor(story.story_points), 0);
  const completedPoints = stories.filter((story) => story.workflow_status.category === 'DONE')
    .reduce((total, story) => total + pointsFor(story.story_points), 0);
  await tx.sprint.update({ where: { id: sprintId }, data: { initial_scope_points: scopePoints, initial_scope_items: stories.length, scopeCapturedAt: capturedAt } });
  await tx.sprintSnapshot.upsert({
    where: { sprint_id_snapshot_date: { sprint_id: sprintId, snapshot_date: day(capturedAt) } },
    create: { sprint_id: sprintId, snapshot_date: day(capturedAt), scope_points: scopePoints, remaining_points: scopePoints - completedPoints, completed_points: completedPoints, added_points: 0, removed_points: 0, total_items: stories.length, completed_items: stories.filter((story) => story.workflow_status.category === 'DONE').length },
    update: { scope_points: scopePoints, remaining_points: scopePoints - completedPoints, completed_points: completedPoints, total_items: stories.length, completed_items: stories.filter((story) => story.workflow_status.category === 'DONE').length },
  });
}

export async function recordSprintScopeChange(tx: DbClient, input: { sprintId: string; userId: string; item: ScopeItem; changeType: SprintScopeChangeType; reason?: string }) {
  await tx.sprintScopeChange.create({ data: {
    sprint_id: input.sprintId, item_id: input.item.id, user_id: input.userId,
    change_type: input.changeType, points: pointsFor(input.item.story_points),
    item_key: input.item.project_key, item_title: input.item.title, reason: input.reason ?? null,
  } });
}

export async function createSprintSnapshot(tx: DbClient, sprintId: string, snapshotAt = new Date()) {
  const sprint = await tx.sprint.findUnique({ where: { id: sprintId }, select: { initial_scope_points: true } });
  if (!sprint || sprint.initial_scope_points === null) return;
  const [stories, changes] = await Promise.all([
    tx.item.findMany({ where: { sprint_id: sprintId, type: 'STORY' }, select: { story_points: true, workflow_status: { select: { category: true } } } }),
    tx.sprintScopeChange.findMany({ where: { sprint_id: sprintId }, select: { change_type: true, points: true } }),
  ]);
  const added = changes.filter((change) => change.change_type === 'ADDED').reduce((sum, change) => sum + change.points, 0);
  const removed = changes.filter((change) => change.change_type === 'REMOVED').reduce((sum, change) => sum + change.points, 0);
  const completed = stories.filter((story) => story.workflow_status.category === 'DONE');
  const completedPoints = completed.reduce((sum, story) => sum + pointsFor(story.story_points), 0);
  const scopePoints = sprint.initial_scope_points + added - removed;
  await tx.sprintSnapshot.upsert({
    where: { sprint_id_snapshot_date: { sprint_id: sprintId, snapshot_date: day(snapshotAt) } },
    create: { sprint_id: sprintId, snapshot_date: day(snapshotAt), scope_points: scopePoints, remaining_points: Math.max(scopePoints - completedPoints, 0), completed_points: completedPoints, added_points: added, removed_points: removed, total_items: stories.length, completed_items: completed.length },
    update: { scope_points: scopePoints, remaining_points: Math.max(scopePoints - completedPoints, 0), completed_points: completedPoints, added_points: added, removed_points: removed, total_items: stories.length, completed_items: completed.length },
  });
}

export async function getSprintMetrics(sprintId: string) {
  const current = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { status: true } });
  if (current?.status === SprintStatus.ACTIVE) await prisma.$transaction((tx) => createSprintSnapshot(tx, sprintId));
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { snapshots: { orderBy: { snapshot_date: 'asc' } }, scopeChanges: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true } } } } },
  });
  if (!sprint) return null;
  const latest = sprint.snapshots.at(-1);
  const addedPoints = sprint.scopeChanges.filter((change) => change.change_type === 'ADDED').reduce((sum, change) => sum + change.points, 0);
  const removedPoints = sprint.scopeChanges.filter((change) => change.change_type === 'REMOVED').reduce((sum, change) => sum + change.points, 0);
  const plannedPoints = sprint.initial_scope_points ?? 0;
  const currentScopePoints = plannedPoints + addedPoints - removedPoints;
  const completedPoints = latest?.completed_points ?? 0;
  return {
    sprint: { id: sprint.id, name: sprint.name, status: sprint.status, startDate: sprint.startDate, endDate: sprint.endDate },
    summary: { plannedPoints, currentScopePoints, completedPoints, remainingPoints: latest?.remaining_points ?? currentScopePoints, addedPoints, removedPoints, completionPercentage: currentScopePoints > 0 ? Math.round((completedPoints / currentScopePoints) * 10000) / 100 : 0 },
    snapshots: dailySeries(sprint.snapshots, sprint.finishedAt ?? new Date()),
    scopeChanges: sprint.scopeChanges,
    calculation: { unestimatedStoryFallbackPoints: UNESTIMATED_STORY_FALLBACK_POINTS, completionCriterion: SPRINT_COMPLETION_CRITERION },
  };
}

export async function getProjectVelocity(projectId: string) {
  const sprints = await prisma.sprint.findMany({ where: { project_id: projectId, status: SprintStatus.FINISHED }, orderBy: { finishedAt: 'asc' }, include: { snapshots: { orderBy: { snapshot_date: 'desc' }, take: 1 } } });
  return sprints.map((sprint) => ({ sprintId: sprint.id, name: sprint.name, finishedAt: sprint.finishedAt, plannedPoints: sprint.initial_scope_points ?? 0, completedPoints: sprint.snapshots[0]?.completed_points ?? 0 }));
}
