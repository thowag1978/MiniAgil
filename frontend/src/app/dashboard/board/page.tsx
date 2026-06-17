'use client';
import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './board.module.css';
import IssueModal from '../../../components/IssueModal';
import CreateItemModal from '../../../components/CreateItemModal';
import { itemsApi } from '@/lib/api/items';
import { projectsApi } from '@/lib/api/projects';
import { queryKeys } from '@/lib/query/keys';
import type { Item } from '@/lib/types';

export default function KanbanBoard() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Item | null>(null);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
  });

  useEffect(() => {
    const projects = projectsQuery.data || [];
    if (projects.length === 0) {
      setSelectedProjectId('');
      return;
    }
    if (!selectedProjectId || !projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projectsQuery.data, selectedProjectId]);

  const boardItemsKey = queryKeys.backlogOverview(selectedProjectId || 'none');

  const backlogQuery = useQuery({
    queryKey: boardItemsKey,
    queryFn: () => itemsApi.backlogOverview(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const items = backlogQuery.data?.sprintItems || [];

  const openIssue = (issue: Item) => {
    setSelectedIssue(issue);
    setIsModalOpen(true);
  };

  const getProjectLabel = (item: Item) => {
    if (item.project?.name) return item.project.name;
    if (item.project?.key_prefix) return item.project.key_prefix;
    return item.project_key?.split('-')[0] || 'Projeto';
  };

  const getSprintLabel = (item: Item) => {
    if (item.sprint?.name) return item.sprint.name;
    return 'Sem sprint';
  };

  const aFazerItems = items.filter(item => item.workflow_status?.name === 'A FAZER');
  const emProgressoItems = items.filter(item => item.workflow_status?.name === 'EM PROGRESSO');
  const paraRevisaoItems = items.filter(item => item.workflow_status?.name === 'PARA REVISÃO');
  const concluidoItems = items.filter(item => item.workflow_status?.name === 'CONCLUÍDO');

  const renderColumn = (title: string, columnItems: Item[]) => (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <h3>{title}</h3>
        <span className={styles.count}>{columnItems.length}</span>
      </div>
      <div className={styles.columnContent}>
        {columnItems.map(item => (
          <div key={item.id} className={styles.ticketCard} onClick={() => openIssue(item)}>
            <div className={styles.tagRow}>
              <div className={styles.projectTag}>{getProjectLabel(item)}</div>
              <div className={`${styles.sprintTag} ${item.sprint ? styles.sprintAssigned : styles.sprintEmpty}`}>
                {getSprintLabel(item)}
              </div>
            </div>
            <div className={styles.ticketTitle}>{item.title}</div>
            <div className={styles.ticketFooter}>
              <span className={`${styles.ticketType} ${item.type === 'BUG' ? styles.typeBug : item.type === 'STORY' ? styles.typeStory : styles.typeTask}`}>
                {item.type}
              </span>
              <span className={styles.ticketKey}>{item.project_key}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

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
            onChange={(e) => setSelectedProjectId(e.target.value)}
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

      {projectsQuery.isLoading || backlogQuery.isLoading ? (
        <div style={{ padding: 20 }}>Carregando tarefas...</div>
      ) : projectsQuery.isError || backlogQuery.isError ? (
        <div style={{ padding: 20, color: '#ff6b6b' }}>Falha ao carregar tarefas.</div>
      ) : !selectedProjectId ? (
        <div style={{ padding: 20, color: 'var(--text-dim)' }}>Crie um projeto primeiro.</div>
      ) : !backlogQuery.data?.activeSprint ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>
          <h3>Nenhuma Sprint Ativa</h3>
          <p style={{ marginTop: 10 }}>Inicie uma sprint na página de Sprints para visualizar o quadro Kanban deste projeto.</p>
        </div>
      ) : (
        <div className={styles.boardColumns}>
          {renderColumn('A Fazer', aFazerItems)}
          {renderColumn('Em Progresso', emProgressoItems)}
          {renderColumn('Para Revisão', paraRevisaoItems)}
          {renderColumn('Concluído', concluidoItems)}
        </div>
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


