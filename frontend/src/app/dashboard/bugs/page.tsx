'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '@/lib/api/items';
import { projectsApi } from '@/lib/api/projects';
import { queryKeys } from '@/lib/query/keys';
import { useAuth } from '@/lib/auth/AuthContext';
import CreateItemModal from '@/components/CreateItemModal';
import IssueModal from '@/components/IssueModal';
import type { BugEnvironment, BugSeverity, Item } from '@/lib/types';
import styles from './bugs.module.css';
import { workflowsApi } from '@/lib/api/workflows';
import KanbanColumns from '@/components/KanbanColumns';

type BugView = 'ALL' | 'MINE' | 'CRITICAL' | 'RETEST' | 'REOPENED' | 'KANBAN';

const views: Array<{ id: BugView; label: string }> = [
  { id: 'ALL', label: 'Todos os bugs' }, { id: 'MINE', label: 'Meus bugs' },
  { id: 'CRITICAL', label: 'Críticos' }, { id: 'RETEST', label: 'Aguardando reteste' },
  { id: 'REOPENED', label: 'Reabertos' },
];

export default function BugsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [view, setView] = useState<BugView>('ALL');
  const [projectIdOverride, setProjectIdOverride] = useState('');
  const [severity, setSeverity] = useState<BugSeverity | ''>('');
  const [environment, setEnvironment] = useState<BugEnvironment | ''>('');
  const [assigneeId, setAssigneeId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [selectedBug, setSelectedBug] = useState<Item | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const projectsQuery = useQuery({ queryKey: queryKeys.projects, queryFn: projectsApi.list });
  const projects = projectsQuery.data || [];
  const projectId = projects.some(({ id }) => id === projectIdOverride) ? projectIdOverride : projects[0]?.id || '';
  const project = projects.find(({ id }) => id === projectId);
  const statusesQuery = useQuery({
    queryKey: queryKeys.itemStatuses(projectId, 'BUG'),
    queryFn: () => itemsApi.listStatuses({ project_id: projectId, type: 'BUG' }),
    enabled: Boolean(projectId),
  });
  const bugWorkflowQuery = useQuery({
    queryKey: queryKeys.projectWorkflow(projectId, 'BUG'),
    queryFn: () => workflowsApi.getByType(projectId, 'BUG'),
    enabled: Boolean(projectId),
  });
  const queryFilter = {
    project_id: projectId || undefined,
    type: 'BUG' as const,
    severity: view === 'CRITICAL' ? 'CRITICAL,BLOCKER' : severity || undefined,
    environment: environment || undefined,
    assignee_id: view === 'MINE' ? user?.id : assigneeId || undefined,
    status_id: statusId || undefined,
    reopened: view === 'REOPENED' || undefined,
    board: view === 'KANBAN' || undefined,
  };
  const bugsKey = queryKeys.itemsByFilter(`bugs:${JSON.stringify(queryFilter)}`);
  const bugsQuery = useQuery({
    queryKey: bugsKey,
    queryFn: () => itemsApi.list(queryFilter),
    enabled: Boolean(projectId && view !== 'RETEST' && (view !== 'MINE' || user?.id)),
  });

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <header className={styles.header}><div><h1>Controle de Bugs</h1><p>Gerencie defeitos sem separá-los do backlog do projeto.</p></div><button className="btn-primary" onClick={() => setCreateOpen(true)}>+ Novo bug</button></header>
      <nav className={styles.views} aria-label="Visões de bugs">
        {views.map((entry) => <button key={entry.id} className={view === entry.id ? styles.active : ''} onClick={() => setView(entry.id)}>{entry.label}</button>)}
        <button className={view === 'KANBAN' ? styles.active : ''} onClick={() => setView('KANBAN')}>Kanban de bugs</button>
      </nav>

      <div className={styles.filters}>
        <select value={projectId} onChange={(event) => { setProjectIdOverride(event.target.value); setStatusId(''); setAssigneeId(''); }}><option value="">Projeto</option>{projects.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>
        <select value={severity} onChange={(event) => setSeverity(event.target.value as BugSeverity | '')} disabled={view === 'CRITICAL'}><option value="">Todas as severidades</option><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option><option value="BLOCKER">Bloqueadora</option></select>
        <select value={environment} onChange={(event) => setEnvironment(event.target.value as BugEnvironment | '')}><option value="">Todos os ambientes</option><option value="DEVELOPMENT">Desenvolvimento</option><option value="TEST">Teste</option><option value="HOMOLOGATION">Homologação</option><option value="PRODUCTION">Produção</option></select>
        <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} disabled={view === 'MINE'}><option value="">Todos os responsáveis</option>{(project?.members || []).map((member) => <option key={member.user_id} value={member.user_id}>{member.user?.name || member.user_id}</option>)}</select>
        <select value={statusId} onChange={(event) => setStatusId(event.target.value)}><option value="">Todos os status</option>{(statusesQuery.data || []).map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select>
      </div>

      {view === 'RETEST' ? <div className={styles.state}>A etapa de reteste ainda não está disponível.</div>
        : view === 'KANBAN' && bugWorkflowQuery.isLoading ? <div className={styles.state}>Carregando workflow de bugs...</div>
        : view === 'KANBAN' && bugWorkflowQuery.isError ? <div className={styles.error}>Não foi possível carregar o workflow de bugs.</div>
        : projectsQuery.isLoading || bugsQuery.isLoading ? <div className={styles.state}>Carregando bugs...</div>
        : projectsQuery.isError || bugsQuery.isError ? <div className={styles.error}>Não foi possível carregar os bugs.</div>
        : view === 'KANBAN' ? <div className={styles.bugBoard}><KanbanColumns variant="bugs" columns={(bugWorkflowQuery.data?.statuses || []).filter((status) => status.is_active !== false).map((status) => ({ status, itemType: 'BUG', wipLimit: status.wip_limit }))} items={bugsQuery.data || []} onOpen={setSelectedBug} onMoved={() => queryClient.invalidateQueries({ queryKey: bugsKey })} /></div>
        : (bugsQuery.data || []).length === 0 ? <div className={styles.state}>Nenhum bug encontrado para os filtros selecionados.</div>
        : <div className={styles.tableWrap}><table><thead><tr><th>Chave</th><th>Título</th><th>Severidade</th><th>Ambiente</th><th>Status</th><th>Responsável</th><th>Reaberturas</th></tr></thead><tbody>{(bugsQuery.data || []).map((bug) => <tr key={bug.id} onClick={() => setSelectedBug(bug)}><td>{bug.project_key}</td><td>{bug.title}</td><td><span className={`${styles.severity} ${styles[bug.bug_details?.severity?.toLowerCase() || 'medium']}`}>{bug.bug_details?.severity || 'MEDIUM'}</span></td><td>{bug.bug_details?.environment || 'TEST'}</td><td>{bug.workflow_status?.name}</td><td>{bug.assignee?.name || 'Não atribuído'}</td><td>{bug.bug_details?.reopened_count || 0}</td></tr>)}</tbody></table></div>}

      {selectedBug && <IssueModal issue={selectedBug} onClose={() => setSelectedBug(null)} onUpdate={() => queryClient.invalidateQueries({ queryKey: bugsKey })} />}
      {createOpen && <CreateItemModal initialType="BUG" initialProjectId={projectId} onClose={() => setCreateOpen(false)} onSuccess={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: bugsKey }); }} />}
    </div>
  );
}
