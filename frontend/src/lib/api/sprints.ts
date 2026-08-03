import { apiRequest } from './client';
import type { Sprint, SprintMetrics, SprintStatus, SprintVelocity } from '@/lib/types';

export const sprintsApi = {
  create(input: { name: string; goal?: string; startDate?: string; endDate?: string; project_id: string }) {
    return apiRequest<Sprint>('/api/sprints', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  list(projectId: string) {
    return apiRequest<Sprint[]>(`/api/sprints?project_id=${projectId}`);
  },
  updateStatus(id: string, status: SprintStatus, options?: { pending_destination?: 'BACKLOG' | 'SPRINT'; target_sprint_id?: string }) {
    return apiRequest<Sprint>(`/api/sprints/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...options }),
    });
  },
  addItem(sprintId: string, itemId: string) {
    return apiRequest(`/api/sprints/${sprintId}/items/${itemId}`, { method: 'POST' });
  },
  removeItem(sprintId: string, itemId: string) {
    return apiRequest(`/api/sprints/${sprintId}/items/${itemId}`, { method: 'DELETE' });
  },
  metrics(sprintId: string) {
    return apiRequest<SprintMetrics>(`/api/sprints/${sprintId}/metrics`);
  },
  velocity(projectId: string) {
    return apiRequest<SprintVelocity[]>(`/api/sprints/velocity?project_id=${projectId}`);
  },
};

