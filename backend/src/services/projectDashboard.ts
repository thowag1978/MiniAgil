import { ItemType, Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/db';

export class ProjectDashboardError extends Error { constructor(public statusCode: number, message: string) { super(message); } }

export interface ProjectDashboardFilters {
  projectId: string;
  type?: ItemType;
  assigneeId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function parseProjectDashboardFilters(query: Record<string, unknown>): ProjectDashboardFilters {
  const projectId = String(query.project_id || '');
  if (!projectId) throw new ProjectDashboardError(400, 'project_id query param is required');
  const typeValue = query.type ? String(query.type).toUpperCase() : undefined;
  if (typeValue && !Object.values(ItemType).includes(typeValue as ItemType)) throw new ProjectDashboardError(400, 'Invalid item type');
  const startDate = query.start_date ? new Date(String(query.start_date)) : undefined;
  const endDate = query.end_date ? new Date(String(query.end_date)) : undefined;
  if (startDate && Number.isNaN(startDate.getTime())) throw new ProjectDashboardError(400, 'Invalid start_date');
  if (endDate && Number.isNaN(endDate.getTime())) throw new ProjectDashboardError(400, 'Invalid end_date');
  if (startDate && endDate && endDate < startDate) throw new ProjectDashboardError(400, 'end_date must be after start_date');
  return {
    projectId,
    ...(typeValue ? { type: typeValue as ItemType } : {}),
    ...(query.assignee_id ? { assigneeId: String(query.assignee_id) } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
}

export async function getProjectDashboard(filters: ProjectDashboardFilters) {
  const updatedAt = filters.startDate || filters.endDate ? {
    ...(filters.startDate ? { gte: filters.startDate } : {}),
    ...(filters.endDate ? { lte: filters.endDate } : {}),
  } : undefined;
  const baseWhere: Prisma.ItemWhereInput = {
    project_id: filters.projectId,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.assigneeId ? { assignee_id: filters.assigneeId } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
  const openWhere: Prisma.ItemWhereInput = { ...baseWhere, workflow_status: { category: { notIn: ['DONE', 'CANCELLED'] } } };
  const bugBase: Prisma.ItemWhereInput = { ...baseWhere, type: filters.type && filters.type !== 'BUG' ? { in: [] } : 'BUG' };
  const bugOpen: Prisma.ItemWhereInput = { ...bugBase, workflow_status: { category: { notIn: ['DONE', 'CANCELLED'] } } };

  const [project, total, completed, inProgress, unassigned, bugsOpen, criticalBugs, reopenedBugs, activeSprint, epics] = await Promise.all([
    prisma.project.findUnique({ where: { id: filters.projectId }, select: { id: true, name: true, key_prefix: true } }),
    prisma.item.count({ where: baseWhere }),
    prisma.item.count({ where: { ...baseWhere, workflow_status: { category: 'DONE' } } }),
    prisma.item.count({ where: { ...baseWhere, workflow_status: { category: { in: ['IN_PROGRESS', 'REVIEW'] } } } }),
    prisma.item.count({ where: { ...openWhere, assignee_id: null } }),
    prisma.item.count({ where: bugOpen }),
    prisma.item.count({ where: { ...bugOpen, bug_details: { severity: { in: ['CRITICAL', 'BLOCKER'] } } } }),
    prisma.item.count({ where: { ...bugOpen, bug_details: { reopened_count: { gt: 0 } } } }),
    prisma.sprint.findFirst({ where: { project_id: filters.projectId, status: 'ACTIVE' }, orderBy: { startedAt: 'desc' }, include: { items: { where: { type: 'STORY' }, select: { story_points: true, workflow_status: { select: { category: true } } } } } }),
    prisma.item.findMany({
      where: { ...baseWhere, type: filters.type && filters.type !== 'EPIC' ? { in: [] } : 'EPIC' },
      select: { id: true, project_key: true, title: true, children: { select: { workflow_status: { select: { category: true } } } } },
      orderBy: { backlog_position: 'asc' },
    }),
  ]);
  if (!project) throw new ProjectDashboardError(404, 'Project not found');

  return {
    project,
    period: { start: filters.startDate?.toISOString() ?? null, end: filters.endDate?.toISOString() ?? null, basis: 'ITEM_UPDATED_AT' },
    updatedAt: new Date().toISOString(),
    metrics: {
      totalItems: total, completedItems: completed, inProgressItems: inProgress,
      overdueItems: { value: 0, supported: false, reason: 'Items do not currently have a due date field.' },
      unassignedItems: unassigned, openBugs: bugsOpen, criticalBugs, reopenedBugs,
    },
    currentSprint: activeSprint ? {
      id: activeSprint.id, name: activeSprint.name, startDate: activeSprint.startDate, endDate: activeSprint.endDate,
      plannedPoints: activeSprint.initial_scope_points ?? 0,
      completedPoints: activeSprint.items.filter((item) => item.workflow_status.category === 'DONE').reduce((sum, item) => sum + (item.story_points ?? 1), 0),
    } : null,
    epicProgress: epics.map((epic) => {
      const totalChildren = epic.children.length;
      const completedChildren = epic.children.filter((child) => child.workflow_status.category === 'DONE').length;
      return { id: epic.id, project_key: epic.project_key, title: epic.title, totalItems: totalChildren, completedItems: completedChildren, percentage: totalChildren ? Math.round((completedChildren / totalChildren) * 10000) / 100 : 0 };
    }),
    filters: { type: filters.type ?? null, assigneeId: filters.assigneeId ?? null },
  };
}
