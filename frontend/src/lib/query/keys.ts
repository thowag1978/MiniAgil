export const queryKeys = {
  auth: ['auth'] as const,
  me: ['auth', 'me'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  items: ['items'] as const,
  itemsByFilter: (filterKey: string) => ['items', filterKey] as const,
  itemStatuses: ['items', 'statuses'] as const,
  hierarchicalItems: (projectId: string) => ['items', 'hierarchical', projectId] as const,
  hierarchicalTree: ['items', 'hierarchical-tree'] as const,
  dashboardMetrics: ['items', 'dashboard-metrics'] as const,
  backlogOverview: (projectId: string) => ['items', 'backlog-overview', projectId] as const,
  sprints: (projectId: string) => ['sprints', projectId] as const,
  users: ['users'] as const,
};

