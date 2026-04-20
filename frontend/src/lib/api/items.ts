import { apiRequest } from './client';
import type { BacklogOverview, DashboardMetrics, Item, ItemType, WorkflowStatus } from '@/lib/types';

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
}

export const itemsApi = {
  list(filters?: { project_id?: string; sprint_id?: string; type?: ItemType }) {
    const params = new URLSearchParams();
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.sprint_id) params.set('sprint_id', filters.sprint_id);
    if (filters?.type) params.set('type', filters.type);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<Item[]>(`/api/items${query}`);
  },
  listStatuses() {
    return apiRequest<WorkflowStatus[]>('/api/items/statuses');
  },
  listHierarchical(projectId: string) {
    return apiRequest<Item[]>(`/api/items/hierarchical?project_id=${projectId}`);
  },
  dashboardMetrics() {
    return apiRequest<DashboardMetrics>('/api/items/dashboard-metrics');
  },
  backlogOverview(projectId: string) {
    return apiRequest<BacklogOverview>(`/api/items/backlog-overview?project_id=${projectId}`);
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
  remove(id: string) {
    return apiRequest<{ success: boolean }>(`/api/items/${id}`, {
      method: 'DELETE',
    });
  },
};

