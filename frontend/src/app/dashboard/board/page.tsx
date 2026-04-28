'use client';
import React, { useState, useEffect, useCallback } from 'react';
import styles from './board.module.css';
import IssueModal from '../../../components/IssueModal';
import CreateItemModal from '../../../components/CreateItemModal';

export default function KanbanBoard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      // For now, let's fetch all items. 
      // If there's a selected project, we'd append ?project_id=...
      const res = await fetch('http://localhost:4000/api/items', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openIssue = (issue: any) => {
    setSelectedIssue(issue);
    setIsModalOpen(true);
  };

  const handleIssueUpdate = () => {
    fetchItems(); // refresh the board on save
  };

  const getProjectLabel = (item: any) => {
    if (item.project?.name) return item.project.name;
    if (item.project?.key_prefix) return item.project.key_prefix;
    return item.project_key?.split('-')[0] || 'Projeto';
  };

  const aFazerItems = items.filter(item => item.workflow_status?.name === 'A FAZER');
  const emProgressoItems = items.filter(item => item.workflow_status?.name === 'EM PROGRESSO');
  const paraRevisaoItems = items.filter(item => item.workflow_status?.name === 'PARA REVISÃO');
  const concluidoItems = items.filter(item => item.workflow_status?.name === 'CONCLUÍDO');

  const renderColumn = (title: string, columnItems: any[]) => (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <h3>{title}</h3>
        <span className={styles.count}>{columnItems.length}</span>
      </div>
      <div className={styles.columnContent}>
        {columnItems.map(item => (
          <div key={item.id} className={styles.ticketCard} onClick={() => openIssue(item)}>
            <div className={styles.projectTag}>{getProjectLabel(item)}</div>
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
          <button className={styles.filterChip} onClick={fetchItems}>🔄 Refresh</button>
        </div>
      </div>
      
      {loading ? (
        <div style={{ padding: 20 }}>Carregando tarefas...</div>
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
          onUpdate={handleIssueUpdate}
        />
      )}

      {isCreateModalOpen && (
        <CreateItemModal 
          onClose={() => setIsCreateModalOpen(false)} 
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchItems();
          }}
        />
      )}
    </div>
  );
}
