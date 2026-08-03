import { getApiBaseUrl } from './client';
import { getToken } from '@/lib/session';
import type { ItemType } from '@/lib/types';
import { apiRequest } from './client';

export interface OperationalReport { generatedAt: string; itemsByStatus: Group[]; itemsByAssignee: Group[]; epicProgress: Array<{ id: string; key: string; title: string; total: number; completed: number; percentage: number }>; sprintResult: { id: string; name: string; status: string; plannedPoints: number; completedPoints: number } | null; bugsBySeverity: Group[]; bugsByEnvironment: Group[]; bugsByAssignee: Group[]; reopenedBugs: number; averageOpenDays: number; }
interface Group { label: string; count: number }
export interface ReportFilters { project_id: string; type?: ItemType; status_id?: string; assignee_id?: string; sprint_id?: string; text?: string }

function query(filters: ReportFilters) { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); }); return params; }

export const reportsApi = {
  operational(filters: ReportFilters) { return apiRequest<OperationalReport>(`/api/reports/operational?${query(filters)}`); },
  async download(type: 'items' | 'backlog' | 'sprint' | 'bugs', filters: ReportFilters) {
    const response = await fetch(`${getApiBaseUrl()}/api/reports/export/${type}?${query(filters)}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || 'Falha ao exportar CSV'); }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `miniagil-${type}.csv`; anchor.click(); URL.revokeObjectURL(url);
  },
};
