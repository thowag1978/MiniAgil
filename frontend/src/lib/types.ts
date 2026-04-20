export type ItemType = 'EPIC' | 'STORY' | 'TASK' | 'SUBTASK' | 'BUG';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type UserRole = 'ADMIN' | 'USER';
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Project {
  id: string;
  name: string;
  key_prefix: string;
  description?: string | null;
}

export interface WorkflowStatus {
  id: string;
  name: string;
  order: number;
}

export interface Sprint {
  id: string;
  name: string;
  goal?: string | null;
  status: SprintStatus;
  startDate?: string | null;
  endDate?: string | null;
  project_id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemRef {
  id: string;
  title: string;
  project_key: string;
  type: ItemType;
}

export interface Item {
  id: string;
  project_key: string;
  type: ItemType;
  title: string;
  description?: string | null;
  workflow_status_id: string;
  priority: Priority;
  reporter_id: string;
  assignee_id?: string | null;
  project_id: string;
  sprint_id?: string | null;
  parent_id?: string | null;
  acceptance_criteria?: string | null;
  estimate?: number | null;
  createdAt: string;
  updatedAt: string;
  workflow_status?: WorkflowStatus;
  assignee?: Pick<AuthUser, 'name' | 'email'> | null;
  reporter?: Pick<AuthUser, 'name'> | null;
  parent?: ItemRef | null;
  children?: Array<ItemRef & { workflow_status?: WorkflowStatus }>;
}

export interface DashboardMetrics {
  counts: {
    pending: number;
    inProgress: number;
    review: number;
    done: number;
  };
  recentItems: Item[];
}

export interface BacklogOverview {
  project: Project;
  activeSprint: Sprint | null;
  sprintItems: Item[];
  backlogItems: Item[];
}

export interface ProjectHierarchy {
  id: string;
  name: string;
  key_prefix: string;
  description?: string | null;
  epics: Item[];
}

