import { apiRequest } from './client';
import type { Sprint, SprintStatus } from '@/lib/types';

export const sprintsApi = {
  list(projectId: string) {
    return apiRequest<Sprint[]>(`/api/sprints?project_id=${projectId}`);
  },
  updateStatus(id: string, status: SprintStatus) {
    return apiRequest<Sprint>(`/api/sprints/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

