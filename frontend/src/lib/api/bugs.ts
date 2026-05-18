import { apiRequest } from './client';
import type { Bug, BugFeature, BugSeverity, BugStatus, BugSystem, BugsDashboardMetrics, Priority } from '@/lib/types';

function buildQuery(params: Record<string, string | boolean | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export const bugSystemsApi = {
  list(input?: { active?: boolean }) {
    const query = input?.active === undefined ? '' : `?active=${input.active}`;
    return apiRequest<BugSystem[]>(`/api/bugs/systems${query}`);
  },
  create(input: { name: string; description?: string | null; active?: boolean }) {
    return apiRequest<BugSystem>('/api/bugs/systems', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  update(id: string, input: { name: string; description?: string | null; active?: boolean }) {
    return apiRequest<BugSystem>(`/api/bugs/systems/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  setActive(id: string, active: boolean) {
    return apiRequest<BugSystem>(`/api/bugs/systems/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
  },
  remove(id: string) {
    return apiRequest<{ success: boolean }>(`/api/bugs/systems/${id}`, {
      method: 'DELETE',
    });
  },
};

export const bugFeaturesApi = {
  list(input?: { system_id?: string; active?: boolean }) {
    return apiRequest<BugFeature[]>(`/api/bugs/features${buildQuery({
      system_id: input?.system_id,
      active: input?.active,
    })}`);
  },
  create(input: { system_id: string; name: string; description?: string | null; active?: boolean }) {
    return apiRequest<BugFeature>('/api/bugs/features', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  update(id: string, input: { system_id: string; name: string; description?: string | null; active?: boolean }) {
    return apiRequest<BugFeature>(`/api/bugs/features/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  setActive(id: string, active: boolean) {
    return apiRequest<BugFeature>(`/api/bugs/features/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
  },
  remove(id: string) {
    return apiRequest<{ success: boolean }>(`/api/bugs/features/${id}`, {
      method: 'DELETE',
    });
  },
};

export type CreateBugInput = {
  system_id: string;
  feature_id?: string | null;
  title: string;
  description?: string | null;
  stepsToReproduce?: string | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  severity: BugSeverity;
  environment?: string | null;
  browserDevice?: string | null;
  attachments?: Array<{
    fileName: string;
    s3_url: string;
  }>;
};

export type BugListFilters = {
  system_id?: string;
  feature_id?: string;
  status?: BugStatus | '';
  severity?: BugSeverity | '';
  priority?: Priority | '';
  assignee_id?: string;
  reporter_id?: string;
  environment?: string;
  created_from?: string;
  created_to?: string;
};

export const bugsApi = {
  dashboard() {
    return apiRequest<BugsDashboardMetrics>('/api/bugs/dashboard');
  },
  list(filters: BugListFilters = {}) {
    return apiRequest<Bug[]>(`/api/bugs${buildQuery(filters)}`);
  },
  getById(id: string) {
    return apiRequest<Bug>(`/api/bugs/${id}`);
  },
  create(input: CreateBugInput) {
    return apiRequest<Bug>('/api/bugs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  addComment(id: string, text: string) {
    return apiRequest(`/api/bugs/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },
  updateStatus(id: string, status: BugStatus, comment?: string) {
    return apiRequest<Bug>(`/api/bugs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    });
  },
  updateAssignee(id: string, assignee_id: string | null) {
    return apiRequest<Bug>(`/api/bugs/${id}/assignee`, {
      method: 'PATCH',
      body: JSON.stringify({ assignee_id }),
    });
  },
  updatePriority(id: string, priority: Priority) {
    return apiRequest<Bug>(`/api/bugs/${id}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ priority }),
    });
  },
  addAttachment(id: string, input: { fileName: string; s3_url: string }) {
    return apiRequest(`/api/bugs/${id}/attachments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
