import { apiRequest } from './client';
import type { BacklogOverview, BugDetails, CustomFieldInputValue, DashboardMetrics, Item, ItemType, KanbanFilters, KanbanMoveResponse, ProjectHierarchy, WorkflowStatus } from '@/lib/types';

export type BugDetailsInput = Partial<Omit<BugDetails, 'id' | 'item_id'>>;

export interface CreateItemInput {
  type: ItemType;
  title: string;
  description?: string;
  priority?: string;
  project_id: string;
  workflow_status_id: string;
  sprint_id?: string | null;
  parent_id?: string | null;
  assignee_id?: string | null;
  acceptance_criteria?: string;
  estimate?: string | number | null;
  due_date?: string | null;
  story_points?: number | null;
  bug_details?: BugDetailsInput;
  custom_fields?: Record<string, CustomFieldInputValue>;
}

export interface UpdateItemInput {
  workflow_status_id?: string;
  assignee_id?: string | null;
  sprint_id?: string | null;
  priority?: string;
  title?: string;
  description?: string;
  parent_id?: string | null;
  acceptance_criteria?: string;
  estimate?: string | number | null;
  due_date?: string | null;
  story_points?: number | null;
  transition_comment?: string;
  bug_details?: BugDetailsInput;
  custom_fields?: Record<string, CustomFieldInputValue>;
}

export const itemsApi = {
  list(filters?: { project_id?: string; sprint_id?: string; type?: ItemType; severity?: string; environment?: string; assignee_id?: string; status_id?: string; reopened?: boolean; board?: boolean; backlog?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.sprint_id) params.set('sprint_id', filters.sprint_id);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.environment) params.set('environment', filters.environment);
    if (filters?.assignee_id) params.set('assignee_id', filters.assignee_id);
    if (filters?.status_id) params.set('status_id', filters.status_id);
    if (filters?.reopened) params.set('reopened', 'true');
    if (filters?.board) params.set('board', 'true');
    if (filters?.backlog) params.set('backlog', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<Item[]>(`/api/items${query}`);
  },
  listStatuses(filters?: { project_id?: string; type?: ItemType }) {
    const params = new URLSearchParams();
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.type) params.set('type', filters.type);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<WorkflowStatus[]>(`/api/items/statuses${query}`);
  },
  listHierarchical(projectId: string) {
    return apiRequest<Item[]>(`/api/items/hierarchical?project_id=${projectId}`);
  },
  listHierarchicalTree() {
    return apiRequest<ProjectHierarchy[]>('/api/items/hierarchical-tree');
  },
  dashboardMetrics(filters: { project_id: string; type?: ItemType; start_date?: string; end_date?: string }) {
    const params = new URLSearchParams({ project_id: filters.project_id });
    if (filters.type) params.set('type', filters.type);
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date) params.set('end_date', filters.end_date);
    return apiRequest<DashboardMetrics>(`/api/items/dashboard-metrics?${params.toString()}`);
  },
  backlogOverview(projectId: string, filters: KanbanFilters = {}) {
    const params = new URLSearchParams({ project_id: projectId });
    if (filters.types?.length) params.set('type', filters.types.join(','));
    if (filters.status_ids?.length) params.set('status_id', filters.status_ids.join(','));
    if (filters.assignee_id) params.set('assignee_id', filters.assignee_id);
    if (filters.priorities?.length) params.set('priority', filters.priorities.join(','));
    if (filters.sprint_id) params.set('sprint_id', filters.sprint_id);
    if (filters.epic_id) params.set('epic_id', filters.epic_id);
    if (filters.text) params.set('text', filters.text);
    if (filters.unassigned) params.set('unassigned', 'true');
    return apiRequest<BacklogOverview>(`/api/items/backlog-overview?${params.toString()}`);
  },
  create(input: CreateItemInput) {
    return apiRequest<Item>('/api/items', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  update(id: string, input: UpdateItemInput) {
    return apiRequest<Item>(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  moveOnBoard(id: string, input: { workflow_status_id: string; target_index: number; expected_updated_at?: string; transition_comment?: string }) {
    return apiRequest<KanbanMoveResponse>(`/api/items/${id}/board-position`, {
      method: 'PATCH', body: JSON.stringify(input),
    });
  },
  moveInBacklog(id: string, input: { target_index: number; expected_updated_at?: string }) {
    return apiRequest<Item>(`/api/items/${id}/backlog-position`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  remove(id: string) {
    return apiRequest<{ success: boolean }>(`/api/items/${id}`, {
      method: 'DELETE',
    });
  },
};

