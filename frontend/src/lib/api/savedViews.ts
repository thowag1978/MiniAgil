import { apiRequest } from './client';
import type { KanbanFilters, SavedView } from '@/lib/types';

export const savedViewsApi = {
  list(projectId: string) {
    return apiRequest<SavedView[]>(`/api/projects/${projectId}/saved-views`);
  },
  create(projectId: string, input: { name: string; filters: KanbanFilters; is_default?: boolean }) {
    return apiRequest<SavedView>(`/api/projects/${projectId}/saved-views`, {
      method: 'POST', body: JSON.stringify(input),
    });
  },
  update(id: string, input: { name?: string; filters?: KanbanFilters; is_default?: boolean }) {
    return apiRequest<SavedView>(`/api/saved-views/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  remove(id: string) {
    return apiRequest<void>(`/api/saved-views/${id}`, { method: 'DELETE' });
  },
};
