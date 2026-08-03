import { ItemType, Priority, Prisma } from '@prisma/client';

export type KanbanFilters = {
  types?: ItemType[];
  status_ids?: string[];
  assignee_id?: string;
  priorities?: Priority[];
  sprint_id?: string;
  epic_id?: string;
  text?: string;
  unassigned?: boolean;
};

export class InvalidSavedViewFiltersError extends Error {}

const allowedKeys = new Set(['types', 'status_ids', 'assignee_id', 'priorities', 'sprint_id', 'epic_id', 'text', 'unassigned']);

function stringArray(value: unknown, allowed?: readonly string[]) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) throw new InvalidSavedViewFiltersError('Invalid filter array');
  const entries = [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
  if (allowed && entries.some((entry) => !allowed.includes(entry))) throw new InvalidSavedViewFiltersError('Invalid filter value');
  return entries;
}

export function normalizeKanbanFilters(value: unknown): KanbanFilters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidSavedViewFiltersError('Filters must be an object');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !allowedKeys.has(key))) throw new InvalidSavedViewFiltersError('Unsupported filter field');
  const result: KanbanFilters = {};
  if (raw.types !== undefined) result.types = stringArray(raw.types, Object.values(ItemType)) as ItemType[];
  if (raw.status_ids !== undefined) result.status_ids = stringArray(raw.status_ids);
  if (raw.priorities !== undefined) result.priorities = stringArray(raw.priorities, Object.values(Priority)) as Priority[];
  for (const key of ['assignee_id', 'sprint_id', 'epic_id'] as const) {
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== 'string' || !raw[key].trim()) throw new InvalidSavedViewFiltersError(`Invalid ${key}`);
      result[key] = raw[key].trim();
    }
  }
  if (raw.text !== undefined) {
    if (typeof raw.text !== 'string' || raw.text.length > 200) throw new InvalidSavedViewFiltersError('Invalid text filter');
    if (raw.text.trim()) result.text = raw.text.trim();
  }
  if (raw.unassigned !== undefined) {
    if (typeof raw.unassigned !== 'boolean') throw new InvalidSavedViewFiltersError('Invalid unassigned filter');
    result.unassigned = raw.unassigned;
  }
  return result;
}

export function kanbanFiltersWhere(filters: KanbanFilters): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = {};
  if (filters.types?.length) where.type = { in: filters.types };
  if (filters.status_ids?.length) where.workflow_status_id = { in: filters.status_ids };
  if (filters.unassigned) where.assignee_id = null;
  else if (filters.assignee_id) where.assignee_id = filters.assignee_id;
  if (filters.priorities?.length) where.priority = { in: filters.priorities };
  if (filters.text) where.OR = [
    { title: { contains: filters.text } },
    { description: { contains: filters.text } },
    { project_key: { contains: filters.text } },
  ];
  if (filters.epic_id) {
    where.AND = [{ OR: [{ parent_id: filters.epic_id }, { parent: { parent_id: filters.epic_id } }] }];
  }
  return where;
}

export function filtersJson(filters: KanbanFilters): Prisma.InputJsonValue {
  return filters as Prisma.InputJsonObject;
}
