import { apiRequest } from './client';
import type { Sprint, SprintStatus } from '@/lib/types';

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
  updateStatus(id: string, status: SprintStatus) {
    return apiRequest<Sprint>(`/api/sprints/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

