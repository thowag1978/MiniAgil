export type ItemType = 'EPIC' | 'STORY' | 'TASK' | 'SUBTASK' | 'BUG';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type UserRole = 'ADMIN' | 'USER';
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
export type BugSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'BLOCKER';
export type BugEnvironment = 'DEVELOPMENT' | 'TEST' | 'HOMOLOGATION' | 'PRODUCTION';
export type BugOrigin = 'DEVELOPMENT' | 'TEST' | 'HOMOLOGATION' | 'PRODUCTION' | 'CUSTOMER' | 'AUDIT' | 'MONITORING';
export type BugReproducibility = 'ALWAYS' | 'INTERMITTENT' | 'ONCE' | 'NOT_REPRODUCED';
export type BugRetestResult = 'APPROVED' | 'FAILED' | 'BLOCKED' | 'NOT_TESTED';
export type CustomFieldType = 'TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTISELECT' | 'USER' | 'URL';
export type CustomFieldInputValue = string | number | boolean | string[] | null;

export interface CustomFieldOption { id: string; field_id: string; label: string; value: string; position: number; is_active: boolean; }
export interface CustomField { id: string; project_id: string; item_type: ItemType; name: string; field_type: CustomFieldType; is_required: boolean; position: number; is_active: boolean; show_on_card: boolean; use_in_filters: boolean; options: CustomFieldOption[]; }
export interface CustomFieldValue { id: string; item_id: string; field_id: string; value: CustomFieldInputValue; field: CustomField; }

export interface BugDetails {
  id: string;
  item_id: string;
  severity: BugSeverity;
  environment: BugEnvironment;
  origin: BugOrigin;
  reproducibility: BugReproducibility;
  reproduction_steps?: string | null;
  expected_result?: string | null;
  actual_result?: string | null;
  technical_analysis?: string | null;
  root_cause?: string | null;
  resolution?: string | null;
  regression: boolean;
  reopened_count: number;
}

export interface BugRetest {
  id: string;
  bug_id: string;
  tester_id: string;
  environment: BugEnvironment;
  result: BugRetestResult;
  observations?: string | null;
  createdAt: string;
  tester: Pick<AuthUser, 'id' | 'name' | 'email'>;
}

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
  owner_id?: string;
  members?: ProjectMembership[];
}

export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface ProjectMembership {
  id: string;
  user_id: string;
  project_id: string;
  role: ProjectRole;
  user?: Pick<AuthUser, 'id' | 'name' | 'email'>;
}

export interface WorkflowStatus {
  id: string;
  name: string;
  order: number;
  workflow_id?: string | null;
  category?: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED';
  color?: string;
  position?: number;
  is_active?: boolean;
  is_initial?: boolean;
  is_final?: boolean;
  wip_limit?: number | null;
  _count?: { items: number };
}

export interface Workflow {
  id: string;
  name: string;
  project_id: string;
  item_type: ItemType;
  is_default: boolean;
  statuses: WorkflowStatus[];
  transitions?: WorkflowTransition[];
}

export interface WorkflowTransition {
  id: string;
  workflow_id: string;
  from_status_id: string;
  to_status_id: string;
  allowed_role?: ProjectRole | null;
  requires_comment: boolean;
  requires_assignee: boolean;
  is_active: boolean;
  fromStatus?: WorkflowStatus;
  toStatus?: WorkflowStatus;
}

export interface ItemComment {
  id: string;
  text: string;
  user_id: string;
  item_id: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  isEdited: boolean;
  user: Pick<AuthUser, 'id' | 'name' | 'email'>;
}

export interface ItemHistoryRecord {
  id: string;
  item_id: string;
  project_id: string;
  user_id: string;
  event_type: string;
  field?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  metadata?: unknown;
  createdAt: string;
  user: Pick<AuthUser, 'id' | 'name' | 'email'>;
}

export interface ItemHistoryPage {
  data: ItemHistoryRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ItemAttachment {
  id: string;
  item_id: string;
  user_id?: string | null;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  createdAt: string;
  user?: Pick<AuthUser, 'id' | 'name' | 'email'> | null;
  canDelete: boolean;
}

export interface ItemAttachmentList {
  data: ItemAttachment[];
  permissions: { canUpload: boolean };
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
  due_date?: string | null;
  board_position: number;
  backlog_position: number;
  story_points?: number | null;
  createdAt: string;
  updatedAt: string;
  workflow_status?: WorkflowStatus;
  project?: Project;
  sprint?: Pick<Sprint, 'id' | 'name' | 'status'> | null;
  assignee?: Pick<AuthUser, 'id' | 'name' | 'email'> | null;
  reporter?: Pick<AuthUser, 'name'> | null;
  parent?: ItemRef | null;
  children?: Array<ItemRef & { workflow_status?: WorkflowStatus }>;
  bug_details?: BugDetails | null;
  custom_field_values?: CustomFieldValue[];
}

export interface SprintMetrics {
  sprint: Pick<Sprint, 'id' | 'name' | 'status' | 'startDate' | 'endDate'>;
  summary: { plannedPoints: number; currentScopePoints: number; completedPoints: number; remainingPoints: number; addedPoints: number; removedPoints: number; completionPercentage: number };
  snapshots: Array<{ id: string; snapshot_date: string; scope_points: number; remaining_points: number; completed_points: number }>;
  scopeChanges: Array<{ id: string; change_type: 'ADDED' | 'REMOVED'; points: number; item_key: string; item_title: string; reason?: string | null; createdAt: string; user: Pick<AuthUser, 'id' | 'name'> }>;
  calculation: { unestimatedStoryFallbackPoints: number; completionCriterion: string };
}

export interface SprintVelocity {
  sprintId: string;
  name: string;
  finishedAt?: string | null;
  plannedPoints: number;
  completedPoints: number;
}

export interface DashboardMetrics {
  project: Pick<Project, 'id' | 'name' | 'key_prefix'>;
  period: { start: string | null; end: string | null; basis: 'ITEM_UPDATED_AT' };
  updatedAt: string;
  metrics: {
    totalItems: number; completedItems: number; inProgressItems: number;
    overdueItems: { value: number; supported: boolean; reason?: string };
    unassignedItems: number; openBugs: number; criticalBugs: number; reopenedBugs: number;
  };
  currentSprint: { id: string; name: string; startDate?: string | null; endDate?: string | null; plannedPoints: number; completedPoints: number } | null;
  epicProgress: Array<{ id: string; project_key: string; title: string; totalItems: number; completedItems: number; percentage: number }>;
  filters: { type: ItemType | null; assigneeId: string | null };
}

export interface BacklogOverview {
  project: Project;
  activeSprint: Sprint | null;
  sprintItems: Item[];
  backlogItems: Item[];
  columns: KanbanColumn[];
  storyPointSummary: { total: number; withoutPoints: number };
}

export interface KanbanColumn {
  status_id: string;
  name: string;
  item_type: ItemType;
  position: number;
  count: number;
  wip_limit: number | null;
  exceeded: boolean;
}

export interface KanbanMoveResponse {
  item: Item;
  column: Pick<KanbanColumn, 'status_id' | 'count' | 'wip_limit' | 'exceeded'>;
  warnings: Array<{ code: string; message: string }>;
}

export interface KanbanFilters {
  types?: ItemType[];
  status_ids?: string[];
  assignee_id?: string;
  priorities?: Priority[];
  sprint_id?: string;
  epic_id?: string;
  text?: string;
  unassigned?: boolean;
}

export interface SavedView {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  view_type: 'KANBAN';
  filters: KanbanFilters;
  is_default: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  started_by_id?: string | null;
  finished_by_id?: string | null;
}

export interface ProjectHierarchy {
  id: string;
  name: string;
  key_prefix: string;
  description?: string | null;
  epics: Item[];
}

