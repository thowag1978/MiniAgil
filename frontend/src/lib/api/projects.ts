import { apiRequest } from './client';
import type { Project } from '@/lib/types';

export const projectsApi = {
  list() {
    return apiRequest<Project[]>('/api/projects');
  },
  getById(id: string) {
    return apiRequest<Project>(`/api/projects/${id}`);
  },
  create(input: { name: string; key_prefix: string; description?: string }) {
    return apiRequest<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

