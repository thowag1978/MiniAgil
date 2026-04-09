'use client';
import React, { useState } from 'react';
import styles from './dashboard.module.css';
import CreateItemModal from '../../components/CreateItemModal';

export default function DashboardPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="animate-fade-in">
      <div className={styles.dashHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Meus Itens</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Resumo das tarefas atribuídas a você no momento.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>+ Criar Item</button>
      </div>
      
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricTitle}>ITENS PENDENTES</div>
          <div className={styles.metricValue}>12</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricTitle}>EM DESENVOLVIMENTO</div>
          <div className={styles.metricValue}>3</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricTitle}>PARA REVIEW</div>
          <div className={styles.metricValue}>1</div>
        </div>
      </div>
      
      <div className={styles.recentSection}>
        <h2>Fila de Trabalho</h2>
        <div className={styles.itemList}>
          <div className={styles.itemRow}>
            <div>
              <strong style={{ color: 'var(--text-secondary)', marginRight: 10 }}>NXT-45</strong>
              <span>Implementar autenticação JWT no frontend</span>
            </div>
            <div className={styles.itemStatus}>EM DESENVOLVIMENTO</div>
          </div>
          <div className={styles.itemRow}>
            <div>
              <strong style={{ color: 'var(--text-secondary)', marginRight: 10 }}>NXT-48</strong>
              <span>Corrigir bug de renderização no Kanban</span>
            </div>
            <div className={styles.itemStatus}>A FAZER</div>
          </div>
          <div className={styles.itemRow}>
            <div>
              <strong style={{ color: 'var(--text-secondary)', marginRight: 10 }}>WEB-12</strong>
              <span>Atualizar copy da landing page</span>
            </div>
            <div className={styles.itemStatus}>A FAZER</div>
          </div>
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateItemModal 
          onClose={() => setIsCreateModalOpen(false)} 
          onSuccess={() => {
            setIsCreateModalOpen(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
