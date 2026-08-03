import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { InvalidSavedViewFiltersError, KanbanFilters, kanbanFiltersWhere, normalizeKanbanFilters } from '../../services/savedViewFilters';

const PAGE_SIZE = 500;
const itemSelect = {
  id: true, project_key: true, type: true, title: true, priority: true, assignee_id: true, sprint_id: true, parent_id: true,
  story_points: true, createdAt: true, updatedAt: true,
  workflow_status: { select: { id: true, name: true, category: true } },
  assignee: { select: { name: true, email: true } }, sprint: { select: { name: true } },
  bug_details: { select: { severity: true, environment: true, reopened_count: true } },
} as const;

export type ReportFilters = KanbanFilters & { projectId: string };
export function parseReportFilters(query: Record<string, unknown>): ReportFilters {
  const projectId = String(query.project_id || '');
  if (!projectId) throw new InvalidSavedViewFiltersError('project_id query param is required');
  const split = (value: unknown) => String(value).split(',').map((entry) => entry.trim()).filter(Boolean);
  const raw: Record<string, unknown> = {};
  if (query.type) raw.types = split(query.type);
  if (query.status_id) raw.status_ids = split(query.status_id);
  if (query.assignee_id) raw.assignee_id = String(query.assignee_id);
  if (query.priority) raw.priorities = split(query.priority);
  if (query.sprint_id) raw.sprint_id = String(query.sprint_id);
  if (query.epic_id) raw.epic_id = String(query.epic_id);
  if (query.text) raw.text = String(query.text);
  if (query.unassigned !== undefined) raw.unassigned = String(query.unassigned) === 'true';
  return { projectId, ...normalizeKanbanFilters(raw) };
}

function whereFor(filters: ReportFilters): Prisma.ItemWhereInput {
  return { project_id: filters.projectId, ...kanbanFiltersWhere(filters), ...(filters.sprint_id ? { sprint_id: filters.sprint_id } : {}) };
}

async function readFilteredItems(filters: ReportFilters) {
  const rows: Array<Prisma.ItemGetPayload<{ select: typeof itemSelect }>> = [];
  let cursor: string | undefined;
  do {
    const page = await prisma.item.findMany({ where: whereFor(filters), select: itemSelect, orderBy: { id: 'asc' }, take: PAGE_SIZE, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    rows.push(...page);
    cursor = page.length === PAGE_SIZE ? page.at(-1)?.id : undefined;
  } while (cursor);
  return rows;
}

function grouped<T>(rows: T[], key: (row: T) => string) {
  const result = new Map<string, number>();
  rows.forEach((row) => result.set(key(row), (result.get(key(row)) ?? 0) + 1));
  return [...result].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function operationalReport(filters: ReportFilters) {
  const [items, sprint] = await Promise.all([
    readFilteredItems(filters),
    filters.sprint_id ? prisma.sprint.findFirst({ where: { id: filters.sprint_id, project_id: filters.projectId }, include: { snapshots: { orderBy: { snapshot_date: 'desc' }, take: 1 } } }) : prisma.sprint.findFirst({ where: { project_id: filters.projectId, status: 'ACTIVE' }, include: { snapshots: { orderBy: { snapshot_date: 'desc' }, take: 1 } } }),
  ]);
  const bugs = items.filter((item) => item.type === 'BUG' && item.bug_details);
  const openBugs = bugs.filter((item) => !['DONE', 'CANCELLED'].includes(item.workflow_status.category));
  const epics = items.filter((item) => item.type === 'EPIC');
  return {
    generatedAt: new Date().toISOString(), filters,
    itemsByStatus: grouped(items, (item) => item.workflow_status.name),
    itemsByAssignee: grouped(items, (item) => item.assignee?.name || 'Sem responsável'),
    epicProgress: epics.map((epic) => { const children = items.filter((item) => item.parent_id === epic.id); const done = children.filter((item) => item.workflow_status.category === 'DONE').length; return { id: epic.id, key: epic.project_key, title: epic.title, total: children.length, completed: done, percentage: children.length ? Math.round(done / children.length * 10000) / 100 : 0 }; }),
    sprintResult: sprint ? { id: sprint.id, name: sprint.name, status: sprint.status, plannedPoints: sprint.initial_scope_points ?? 0, completedPoints: sprint.snapshots[0]?.completed_points ?? 0 } : null,
    bugsBySeverity: grouped(bugs, (item) => item.bug_details!.severity),
    bugsByEnvironment: grouped(bugs, (item) => item.bug_details!.environment),
    bugsByAssignee: grouped(bugs, (item) => item.assignee?.name || 'Sem responsável'),
    reopenedBugs: bugs.filter((item) => (item.bug_details?.reopened_count ?? 0) > 0).length,
    averageOpenDays: openBugs.length ? Math.round(openBugs.reduce((sum, item) => sum + (Date.now() - item.createdAt.getTime()) / 86_400_000, 0) / openBugs.length * 100) / 100 : 0,
  };
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function streamCsv(res: Response, filters: ReportFilters, target: string) {
  const allowed = ['items', 'backlog', 'sprint', 'bugs'];
  if (!allowed.includes(target)) throw new InvalidSavedViewFiltersError('Invalid export type');
  const targetWhere: Prisma.ItemWhereInput = target === 'backlog' ? { sprint_id: null } : target === 'bugs' ? { type: 'BUG' } : target === 'sprint' ? { sprint_id: filters.sprint_id || '__missing__' } : {};
  if (target === 'sprint' && !filters.sprint_id) throw new InvalidSavedViewFiltersError('sprint_id is required for sprint export');
  res.status(200).set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="miniagil-${target}.csv"` });
  res.write('\uFEFF' + ['Chave','Tipo','Título','Status','Categoria','Prioridade','Responsável','Sprint','Story points','Severidade','Ambiente','Reaberturas','Criado em','Atualizado em'].map(csvCell).join(';') + '\r\n');
  let cursor: string | undefined;
  do {
    const page = await prisma.item.findMany({ where: { ...whereFor(filters), ...targetWhere }, select: itemSelect, orderBy: { id: 'asc' }, take: PAGE_SIZE, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    page.forEach((item) => res.write([item.project_key,item.type,item.title,item.workflow_status.name,item.workflow_status.category,item.priority,item.assignee?.name,item.sprint?.name,item.story_points,item.bug_details?.severity,item.bug_details?.environment,item.bug_details?.reopened_count,item.createdAt,item.updatedAt].map(csvCell).join(';') + '\r\n'));
    cursor = page.length === PAGE_SIZE ? page.at(-1)?.id : undefined;
  } while (cursor);
  res.end();
}
