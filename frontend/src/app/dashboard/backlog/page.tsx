'use client';
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './backlog.module.css';
import CreateItemModal from '../../../components/CreateItemModal';
import { projectsApi } from '@/lib/api/projects';
import { itemsApi } from '@/lib/api/items';
import { sprintsApi } from '@/lib/api/sprints';
import { queryKeys } from '@/lib/query/keys';
import type { Item } from '@/lib/types';
import IssueModal from '@/components/IssueModal';

function getPriorityLabel(priority: string) {
  if (priority === 'CRITICAL') return 'Crítica';
  if (priority === 'HIGH') return 'Alta';
  if (priority === 'MEDIUM') return 'Média';
  return 'Baixa';
}

function typeClass(type: string) {
  if (type === 'EPIC') return styles.typeEpic;
  if (type === 'STORY') return styles.typeStory;
  if (type === 'BUG') return styles.typeBug;
  return styles.typeTask;
}

export default function BacklogPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedProjectIdOverride, setSelectedProjectIdOverride] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [onlyWithoutPoints, setOnlyWithoutPoints] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
  });

  const projects = projectsQuery.data || [];
  const selectedProjectId = projects.some((project) => project.id === selectedProjectIdOverride)
    ? selectedProjectIdOverride
    : projects[0]?.id || '';

  const backlogQuery = useQuery({
    queryKey: queryKeys.backlogOverview(selectedProjectId || 'none'),
    queryFn: () => itemsApi.backlogOverview(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const closeSprintMutation = useMutation({
    mutationFn: (sprintId: string) => sprintsApi.updateStatus(sprintId, 'FINISHED', { pending_destination: 'BACKLOG' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(selectedProjectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints(selectedProjectId) });
    },
  });
  const reorderMutation = useMutation({
    mutationFn: ({ item, targetIndex }: { item: Item; targetIndex: number }) => itemsApi.moveInBacklog(item.id, { target_index: targetIndex, expected_updated_at: item.updatedAt }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(selectedProjectId) }),
    onError: (error: Error) => window.alert(error.message),
  });

  const selectedProject = projectsQuery.data?.find((project) => project.id === selectedProjectId);

  const filteredSprintItems = useMemo(() => {
    const list = backlogQuery.data?.sprintItems || [];
    if (!search.trim()) return list;
    const normalized = search.toLowerCase();
    return list.filter(item => item.title.toLowerCase().includes(normalized) || item.project_key.toLowerCase().includes(normalized));
  }, [backlogQuery.data?.sprintItems, search]);

  const filteredBacklogItems = useMemo(() => {
    const list = backlogQuery.data?.backlogItems || [];
    const normalized = search.toLowerCase().trim();
    return list.filter(item => (!normalized || item.title.toLowerCase().includes(normalized) || item.project_key.toLowerCase().includes(normalized))
      && (!typeFilter || item.type === typeFilter) && (!onlyWithoutPoints || (item.type === 'STORY' && item.story_points == null)));
  }, [backlogQuery.data?.backlogItems, search, typeFilter, onlyWithoutPoints]);

  const renderIssueCard = (item: Item, reorderable = false) => (
    <div key={item.id} className={`${styles.issueCard} ${item.type === 'STORY' && item.story_points == null ? styles.withoutPoints : ''}`} draggable={reorderable} onDragStart={() => reorderable && setDraggedItem(item)} onDragEnd={() => setDraggedItem(null)} onDragOver={event => reorderable && event.preventDefault()} onDrop={event => { if (!reorderable || !draggedItem) return; event.preventDefault(); event.stopPropagation(); const targetIndex = (backlogQuery.data?.backlogItems || []).findIndex(candidate => candidate.id === item.id); reorderMutation.mutate({ item: draggedItem, targetIndex }); }} onClick={() => setSelectedItem(item)}>
      <span className={`${styles.issueType} ${typeClass(item.type)}`}>{item.type}</span>
      <span className={styles.issueKey}>{item.project_key}</span>
      <span className={styles.issueTitle}>{item.title}</span>
      <span className={styles.issuePriority}>{getPriorityLabel(item.priority)}</span>
      {item.type === 'STORY' && <span className={styles.storyPoints}>{item.story_points == null ? 'Sem pontos' : `${item.story_points} SP`}</span>}
    </div>
  );

  if (projectsQuery.isLoading || backlogQuery.isLoading || ((projectsQuery.data?.length || 0) > 0 && !selectedProjectId)) {
    return <div style={{ padding: 16 }}>Carregando backlog...</div>;
  }

  if (projectsQuery.isError || backlogQuery.isError) {
    return <div style={{ padding: 16, color: '#ff6b6b' }}>Não foi possível carregar o backlog.</div>;
  }

  if (!selectedProjectId || !backlogQuery.data) {
    return <div style={{ padding: 16 }}>Nenhum projeto disponível para exibir backlog.</div>;
  }

  const { activeSprint } = backlogQuery.data;

  return (
    <div className="animate-fade-in">
      <div className={styles.dashHeader}>
        <h1>Backlog do Projeto</h1>
        <div className={styles.actionBar}>
          <select
            className={`input-glass ${styles.projectSelect}`}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectIdOverride(e.target.value)}
            aria-label="Selecionar projeto"
          >
            {(projectsQuery.data || []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.key_prefix})
              </option>
            ))}
          </select>
          <input
            type="text"
            className="input-glass"
            placeholder="Buscar tarefa..."
            style={{ maxWidth: '300px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input-glass" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">Todos os tipos</option><option value="STORY">Histórias</option><option value="TASK">Atividades</option><option value="BUG">Bugs</option></select>
          <label className={styles.pointsFilter}><input type="checkbox" checked={onlyWithoutPoints} onChange={e => setOnlyWithoutPoints(e.target.checked)} /> Histórias sem pontos</label>
          <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>+ Criar Item</button>
        </div>
      </div>

      <div className={styles.sprintBoard}>
        <div className={styles.sprintHeader}>
          <div className={styles.sprintTitle}>
            <h3>{activeSprint ? `Sprint Atual (${activeSprint.name})` : 'Sprint Atual'}</h3>
            <span className={styles.sprintDates}>
              {activeSprint?.startDate && activeSprint?.endDate
                ? `${new Date(activeSprint.startDate).toLocaleDateString('pt-BR')} - ${new Date(activeSprint.endDate).toLocaleDateString('pt-BR')}`
                : activeSprint ? 'Sem datas definidas' : `${selectedProject?.name || 'Projeto'} sem sprint ativa`}
            </span>
          </div>
          <button
            className={`btn-primary ${styles.btnOutline}`}
            disabled={!activeSprint || closeSprintMutation.isPending}
            onClick={() => {
              if (activeSprint) closeSprintMutation.mutate(activeSprint.id);
            }}
          >
            Concluir Sprint
          </button>
        </div>
        <div className={styles.issueList}>
          {filteredSprintItems.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Nenhuma tarefa na sprint ativa.</div>
          ) : (
            filteredSprintItems.map(item => renderIssueCard(item))
          )}
        </div>
      </div>

      <div className={styles.backlogBoard}>
        <div className={styles.sprintHeader}>
          <div className={styles.sprintTitle}>
            <h3>Backlog</h3>
            <span className={styles.sprintDates}>{filteredBacklogItems.length} itens · {backlogQuery.data.storyPointSummary.total} pontos · {backlogQuery.data.storyPointSummary.withoutPoints} história(s) sem pontos</span>
          </div>
          <button className={`btn-primary ${styles.btnOutline}`} disabled>Criar Sprint</button>
        </div>
        <div className={styles.issueList} onDragOver={event => event.preventDefault()} onDrop={() => { if (draggedItem) reorderMutation.mutate({ item: draggedItem, targetIndex: backlogQuery.data.backlogItems.length }); }}>
          {filteredBacklogItems.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Nenhuma tarefa no backlog.</div>
          ) : (
            filteredBacklogItems.map(item => renderIssueCard(item, true))
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateItemModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(selectedProjectId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
            queryClient.invalidateQueries({ queryKey: queryKeys.items });
          }}
        />
      )}
      {selectedItem && <IssueModal issue={selectedItem} onClose={() => setSelectedItem(null)} onUpdate={() => { queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(selectedProjectId) }); setSelectedItem(null); }} />}
    </div>
  );
}


