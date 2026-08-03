import { apiRequest } from './client';
import type { ItemType, ProjectRole, Workflow, WorkflowStatus, WorkflowTransition } from '@/lib/types';

export type WorkflowStatusInput = {
  name?: string;
  category?: WorkflowStatus['category'];
  color?: string;
  position?: number;
  is_active?: boolean;
  is_initial?: boolean;
  is_final?: boolean;
  wip_limit?: number | null;
  replacement_status_id?: string;
};

export type WorkflowTransitionInput = {
  from_status_id: string;
  to_status_id: string;
  allowed_role?: ProjectRole | null;
  requires_comment?: boolean;
  requires_assignee?: boolean;
  is_active?: boolean;
};

const base = (projectId: string) => `/api/projects/${projectId}/workflows`;

export const workflowsApi = {
  list(projectId: string) {
    return apiRequest<Workflow[]>(base(projectId));
  },
  getByType(projectId: string, itemType: ItemType) {
    return apiRequest<Workflow>(`${base(projectId)}/type/${itemType}`);
  },
  createStatus(projectId: string, workflowId: string, input: Required<Pick<WorkflowStatusInput, 'name' | 'category' | 'color'>> & WorkflowStatusInput) {
    return apiRequest<WorkflowStatus>(`${base(projectId)}/${workflowId}/statuses`, {
      method: 'POST', body: JSON.stringify(input),
    });
  },
  updateStatus(projectId: string, workflowId: string, statusId: string, input: WorkflowStatusInput) {
    return apiRequest<WorkflowStatus>(`${base(projectId)}/${workflowId}/statuses/${statusId}`, {
      method: 'PATCH', body: JSON.stringify(input),
    });
  },
  reorderStatuses(projectId: string, workflowId: string, statusIds: string[]) {
    return apiRequest<Workflow>(`${base(projectId)}/${workflowId}/statuses/reorder`, {
      method: 'PATCH', body: JSON.stringify({ status_ids: statusIds }),
    });
  },
  createTransition(projectId: string, workflowId: string, input: WorkflowTransitionInput) {
    return apiRequest<WorkflowTransition>(`${base(projectId)}/${workflowId}/transitions`, {
      method: 'POST', body: JSON.stringify(input),
    });
  },
  updateTransition(projectId: string, workflowId: string, transitionId: string, input: Partial<Omit<WorkflowTransitionInput, 'from_status_id' | 'to_status_id'>>) {
    return apiRequest<WorkflowTransition>(`${base(projectId)}/${workflowId}/transitions/${transitionId}`, {
      method: 'PATCH', body: JSON.stringify(input),
    });
  },
};
