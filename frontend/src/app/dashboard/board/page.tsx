'use client';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './board.module.css';
import IssueModal from '../../../components/IssueModal';
import CreateItemModal from '../../../components/CreateItemModal';
import { itemsApi } from '@/lib/api/items';
import { queryKeys } from '@/lib/query/keys';
import type { Item } from '@/lib/types';

export default function KanbanBoard() {
  const queryClient = useQueryClient();
  const boardItemsKey = queryKeys.itemsByFilter('kanban:tasks');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Item | null>(null);

  const itemsQuery = useQuery({
    queryKey: boardItemsKey,
    queryFn: () => itemsApi.list({ type: 'TASK' }),
  });

  const items = itemsQuery.data || [];

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
        <h1>Kanban do Projeto</h1>
        <div className={styles.filters}>
          <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>+ Criar Tarefa</button>
          <button className={styles.filterChip} onClick={() => queryClient.invalidateQueries({ queryKey: boardItemsKey })}>Refresh</button>
        </div>
      </div>

      {itemsQuery.isLoading ? (
        <div style={{ padding: 20 }}>Carregando tarefas...</div>
      ) : itemsQuery.isError ? (
        <div style={{ padding: 20, color: '#ff6b6b' }}>Falha ao carregar tarefas.</div>
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


