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

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
  });

  const selectedProjectId = projectsQuery.data?.[0]?.id || '';

  const backlogQuery = useQuery({
    queryKey: queryKeys.backlogOverview(selectedProjectId || 'none'),
    queryFn: () => itemsApi.backlogOverview(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const closeSprintMutation = useMutation({
    mutationFn: (sprintId: string) => sprintsApi.updateStatus(sprintId, 'CLOSED'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(selectedProjectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints(selectedProjectId) });
    },
  });

  const filteredSprintItems = useMemo(() => {
    const list = backlogQuery.data?.sprintItems || [];
    if (!search.trim()) return list;
    const normalized = search.toLowerCase();
    return list.filter(item => item.title.toLowerCase().includes(normalized) || item.project_key.toLowerCase().includes(normalized));
  }, [backlogQuery.data?.sprintItems, search]);

  const filteredBacklogItems = useMemo(() => {
    const list = backlogQuery.data?.backlogItems || [];
    if (!search.trim()) return list;
    const normalized = search.toLowerCase();
    return list.filter(item => item.title.toLowerCase().includes(normalized) || item.project_key.toLowerCase().includes(normalized));
  }, [backlogQuery.data?.backlogItems, search]);

  const renderIssueCard = (item: Item) => (
    <div key={item.id} className={styles.issueCard}>
      <span className={`${styles.issueType} ${typeClass(item.type)}`}>{item.type}</span>
      <span className={styles.issueKey}>{item.project_key}</span>
      <span className={styles.issueTitle}>{item.title}</span>
      <span className={styles.issuePriority}>{getPriorityLabel(item.priority)}</span>
    </div>
  );

  if (projectsQuery.isLoading || backlogQuery.isLoading) {
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
          <input
            type="text"
            className="input-glass"
            placeholder="Buscar tarefa..."
            style={{ maxWidth: '300px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                : activeSprint ? 'Sem datas definidas' : 'Nenhuma sprint ativa'}
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
            filteredSprintItems.map(renderIssueCard)
          )}
        </div>
      </div>

      <div className={styles.backlogBoard}>
        <div className={styles.sprintHeader}>
          <div className={styles.sprintTitle}>
            <h3>Backlog</h3>
            <span className={styles.sprintDates}>{filteredBacklogItems.length} tarefas pendentes</span>
          </div>
          <button className={`btn-primary ${styles.btnOutline}`} disabled>Criar Sprint</button>
        </div>
        <div className={styles.issueList}>
          {filteredBacklogItems.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Nenhuma tarefa no backlog.</div>
          ) : (
            filteredBacklogItems.map(renderIssueCard)
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
    </div>
  );
}


