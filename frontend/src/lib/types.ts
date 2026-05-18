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
  project?: Project;
  sprint?: Pick<Sprint, 'id' | 'name' | 'status'> | null;
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
  projectOverview: Array<{
    id: string;
    name: string;
    key_prefix: string;
    totalItems: number;
    openItems: number;
    doneItems: number;
  }>;
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

export interface BugSystem {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BugFeature {
  id: string;
  name: string;
  description?: string | null;
  system_id: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  system?: Pick<BugSystem, 'id' | 'name' | 'active'>;
}

export type BugSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BugStatus = 'OPEN' | 'TRIAGE' | 'CONFIRMED' | 'IN_FIX' | 'WAITING_VALIDATION' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | 'REJECTED' | 'DUPLICATED' | 'CANCELED';

export interface BugAttachment {
  id: string;
  s3_url: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  bug_id: string;
  user_id: string;
  createdAt: string;
  user?: Pick<AuthUser, 'id' | 'name' | 'email'>;
}

export interface BugComment {
  id: string;
  text: string;
  bug_id: string;
  user_id: string;
  createdAt: string;
  user?: Pick<AuthUser, 'id' | 'name' | 'email'>;
}

export interface BugStatusHistory {
  id: string;
  bug_id: string;
  from_status?: BugStatus | null;
  to_status: BugStatus;
  comment?: string | null;
  user_id: string;
  createdAt: string;
  user?: Pick<AuthUser, 'id' | 'name' | 'email'>;
}

export interface Bug {
  id: string;
  protocol: string;
  title: string;
  description?: string | null;
  stepsToReproduce?: string | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  environment?: string | null;
  browserDevice?: string | null;
  status: BugStatus;
  severity: BugSeverity;
  priority: Priority;
  system_id: string;
  feature_id?: string | null;
  reporter_id: string;
  assignee_id?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  system?: Pick<BugSystem, 'id' | 'name'>;
  feature?: Pick<BugFeature, 'id' | 'name'> | null;
  reporter?: Pick<AuthUser, 'id' | 'name' | 'email'>;
  assignee?: Pick<AuthUser, 'id' | 'name' | 'email'> | null;
  attachments?: BugAttachment[];
  comments?: BugComment[];
  statusHistory?: BugStatusHistory[];
}

export interface BugsDashboardMetrics {
  totalOpen: number;
  critical: number;
  reopened: number;
  averageResolutionHours: number | null;
  bySystem: Array<{
    system_id: string;
    name: string;
    total: number;
  }>;
  byStatus: Array<{
    status: BugStatus;
    total: number;
  }>;
  byAssignee: Array<{
    assignee_id?: string | null;
    name: string;
    total: number;
  }>;
}

