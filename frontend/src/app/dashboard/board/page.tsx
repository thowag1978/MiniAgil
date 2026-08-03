'use client';
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './board.module.css';
import IssueModal from '../../../components/IssueModal';
import CreateItemModal from '../../../components/CreateItemModal';
import { itemsApi } from '@/lib/api/items';
import { projectsApi } from '@/lib/api/projects';
import { queryKeys } from '@/lib/query/keys';
import type { Item } from '@/lib/types';
import { workflowsApi } from '@/lib/api/workflows';
import { sprintsApi } from '@/lib/api/sprints';
import KanbanFilters from '@/components/KanbanFilters';
import type { KanbanFilters as FilterValues } from '@/lib/types';
import KanbanColumns from '@/components/KanbanColumns';

export default function KanbanBoard() {
  const queryClient = useQueryClient();
  const [selectedProjectIdOverride, setSelectedProjectIdOverride] = useState(() => typeof window === 'undefined' ? '' : window.localStorage.getItem('miniagil:kanban-project') || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Item | null>(null);
  const [filtersByProject, setFiltersByProject] = useState<Record<string, FilterValues>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(window.localStorage.getItem('miniagil:kanban-filters') || '{}'); } catch { return {}; }
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
  });

  const projects = projectsQuery.data || [];
  const selectedProjectId = projects.some((project) => project.id === selectedProjectIdOverride)
    ? selectedProjectIdOverride
    : projects[0]?.id || '';
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const filters = filtersByProject[selectedProjectId] || {};
  const filtersKey = JSON.stringify(filters);

  const boardItemsKey = queryKeys.backlogOverview(selectedProjectId || 'none', filtersKey);

  const backlogQuery = useQuery({
    queryKey: boardItemsKey,
    queryFn: () => itemsApi.backlogOverview(selectedProjectId, filters),
    enabled: Boolean(selectedProjectId),
  });

  const workflowsQuery = useQuery({
    queryKey: queryKeys.projectWorkflows(selectedProjectId || 'none'),
    queryFn: () => workflowsApi.list(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  const sprintsQuery = useQuery({
    queryKey: queryKeys.sprints(selectedProjectId || 'none'),
    queryFn: () => sprintsApi.list(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  const epicsQuery = useQuery({
    queryKey: queryKeys.itemsByFilter(`${selectedProjectId}:EPIC:kanban-filter`),
    queryFn: () => itemsApi.list({ project_id: selectedProjectId, type: 'EPIC' }),
    enabled: Boolean(selectedProjectId),
  });

  const items = useMemo(() => backlogQuery.data?.sprintItems || [], [backlogQuery.data?.sprintItems]);

  const updateFilters = (next: FilterValues) => {
    setFiltersByProject((current) => {
      const updated = { ...current, [selectedProjectId]: next };
      window.localStorage.setItem('miniagil:kanban-filters', JSON.stringify(updated));
      return updated;
    });
  };

  const openIssue = (issue: Item) => {
    setSelectedIssue(issue);
    setIsModalOpen(true);
  };

  const boardStatuses = useMemo(() => {
    const itemTypes = new Set(items.map((item) => item.type));
    return (workflowsQuery.data || [])
      .filter((workflow) => itemTypes.has(workflow.item_type))
      .flatMap((workflow) => workflow.statuses
        .filter((status) => status.is_active !== false)
        .map((status) => ({ status, itemType: workflow.item_type })))
      .sort((left, right) => left.itemType.localeCompare(right.itemType)
        || (left.status.position ?? left.status.order ?? 0) - (right.status.position ?? right.status.order ?? 0));
  }, [items, workflowsQuery.data]);

  return (
    <div className={`animate-fade-in ${styles.boardWrapper}`}>
      <div className={styles.boardHeader}>
        <div>
          <h1>Kanban do Projeto</h1>
          {backlogQuery.data?.activeSprint && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 5 }}>
              Sprint Ativa: <strong>{backlogQuery.data.activeSprint.name}</strong>
            </p>
          )}
        </div>
        <div className={styles.filters} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            className="input-glass"
            value={selectedProjectId}
            onChange={(e) => { setSelectedProjectIdOverride(e.target.value); window.localStorage.setItem('miniagil:kanban-project', e.target.value); }}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}
            aria-label="Selecionar projeto"
          >
            {(projectsQuery.data || []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.key_prefix})
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>+ Criar Item</button>
          <button className={styles.filterChip} onClick={() => queryClient.invalidateQueries({ queryKey: boardItemsKey })}>Refresh</button>
        </div>
      </div>

      {selectedProject && (
        <KanbanFilters
          project={selectedProject}
          workflows={workflowsQuery.data || []}
          sprints={sprintsQuery.data || []}
          epics={epicsQuery.data || []}
          filters={filters}
          onChange={updateFilters}
        />
      )}

      {projectsQuery.isLoading || backlogQuery.isLoading || workflowsQuery.isLoading || sprintsQuery.isLoading || epicsQuery.isLoading ? (
        <div style={{ padding: 20 }}>Carregando tarefas...</div>
      ) : projectsQuery.isError || backlogQuery.isError || workflowsQuery.isError || sprintsQuery.isError || epicsQuery.isError ? (
        <div style={{ padding: 20, color: '#ff6b6b' }}>Falha ao carregar tarefas.</div>
      ) : !selectedProjectId ? (
        <div style={{ padding: 20, color: 'var(--text-dim)' }}>Crie um projeto primeiro.</div>
      ) : !backlogQuery.data?.activeSprint ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>
          <h3>Nenhuma Sprint Ativa</h3>
          <p style={{ marginTop: 10 }}>Inicie uma sprint na página de Sprints para visualizar o quadro Kanban deste projeto.</p>
        </div>
      ) : (
        <KanbanColumns columns={boardStatuses.map(({ status, itemType }) => ({ status, itemType, wipLimit: backlogQuery.data?.columns?.find((column) => column.status_id === status.id)?.wip_limit }))} items={items} onOpen={openIssue} onMoved={() => queryClient.invalidateQueries({ queryKey: boardItemsKey })} />
      )}

      {isModalOpen && (
        <IssueModal
          issue={selectedIssue}
          onClose={() => setIsModalOpen(false)}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: boardItemsKey })}
        />
      )}

      {isCreateModalOpen && (
        <CreateItemModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            queryClient.invalidateQueries({ queryKey: boardItemsKey });
            queryClient.invalidateQueries({ queryKey: queryKeys.items });
          }}
        />
      )}
    </div>
  );
}


