'use client';
import React, { useState } from 'react';
import styles from './board.module.css';
import IssueModal from '../../../components/IssueModal';

export default function KanbanBoard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);

  const openIssue = (issueKey: string) => {
    setSelectedIssue({ key: issueKey, title: 'Implementar layout do Dashboard', status: 'Em Progresso' });
    setIsModalOpen(true);
  };

  return (
    <div className={`animate-fade-in ${styles.boardWrapper}`}>
      <div className={styles.boardHeader}>
        <h1>Kanban do Projeto</h1>
        <div className={styles.filters}>
          <span className={styles.filterChip}>Apenas meus tickets</span>
          <span className={styles.filterChip}>Sprints Ativas</span>
        </div>
      </div>
      
      <div className={styles.boardColumns}>
        {/* Coluna 1 */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h3>A Fazer</h3>
            <span className={styles.count}>2</span>
          </div>
          <div className={styles.columnContent}>
            <div className={styles.ticketCard} onClick={() => openIssue('NXT-48')}>
              <div className={styles.ticketTitle}>Corrigir bug de renderização no Kanban</div>
              <div className={styles.ticketFooter}>
                <span className={styles.ticketType}>BUG</span>
                <span className={styles.ticketKey}>NXT-48</span>
              </div>
            </div>
            <div className={styles.ticketCard} onClick={() => openIssue('WEB-12')}>
              <div className={styles.ticketTitle}>Atualizar copy da landing page</div>
              <div className={styles.ticketFooter}>
                <span className={`${styles.ticketType} ${styles.typeTask}`}>TASK</span>
                <span className={styles.ticketKey}>WEB-12</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Coluna 2 */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h3>Em Progresso</h3>
            <span className={styles.count}>1</span>
          </div>
          <div className={styles.columnContent}>
            <div className={styles.ticketCard} onClick={() => openIssue('NXT-45')}>
              <div className={styles.ticketTitle}>Implementar autenticação JWT no frontend</div>
              <div className={styles.ticketFooter}>
                <span className={`${styles.ticketType} ${styles.typeStory}`}>STORY</span>
                <span className={styles.ticketKey}>NXT-45</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 3 */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h3>Concluído</h3>
            <span className={styles.count}>0</span>
          </div>
          <div className={styles.columnContent}>
            {/* Empty space */}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <IssueModal 
          issue={selectedIssue} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </div>
  );
}
