import { apiRequest } from './client';
import type { AuthUser, Project } from '@/lib/types';

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  members: Array<{ id: string; user: AuthUser }>;
  projects: Array<{ id: string; project: Pick<Project, 'id' | 'name' | 'key_prefix'> }>;
}

export interface TeamInput {
  name: string;
  description?: string;
  user_ids: string[];
  project_ids: string[];
}

export const teamsApi = {
  list() {
    return apiRequest<Team[]>('/api/teams');
  },
  create(input: TeamInput) {
    return apiRequest<Team>('/api/teams', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  update(id: string, input: TeamInput) {
    return apiRequest<Team>(`/api/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  remove(id: string) {
    return apiRequest<void>(`/api/teams/${id}`, { method: 'DELETE' });
  },
};
