'use client';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './dashboard.module.css';
import CreateItemModal from '../../components/CreateItemModal';
import { itemsApi } from '@/lib/api/items';
import { queryKeys } from '@/lib/query/keys';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.dashboardMetrics,
    queryFn: () => itemsApi.dashboardMetrics(),
  });

  const counts = data?.counts || { pending: 0, inProgress: 0, review: 0, done: 0 };
  const recentItems = data?.recentItems || [];
  const projectOverview = data?.projectOverview || [];

  return (
    <div className="animate-fade-in">
      <div className={styles.dashHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Meus Itens</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Resumo das tarefas atribuídas ou reportadas por você.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>+ Criar Item</button>
      </div>

      {isLoading ? (
        <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Carregando métricas...</div>
      ) : isError ? (
        <div style={{ padding: 16, color: '#ff6b6b' }}>Falha ao carregar dados do dashboard.</div>
      ) : (
        <>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricTitle}>ITENS PENDENTES</div>
              <div className={styles.metricValue}>{counts.pending}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricTitle}>EM DESENVOLVIMENTO</div>
              <div className={styles.metricValue}>{counts.inProgress}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricTitle}>PARA REVIEW</div>
              <div className={styles.metricValue}>{counts.review}</div>
            </div>
          </div>

          <div className={styles.projectSection}>
            <h2>Visão por Projeto</h2>
            {projectOverview.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Nenhum projeto encontrado.</div>
            ) : (
              <div className={styles.projectGrid}>
                {projectOverview.map((project) => (
                  <div key={project.id} className={styles.projectCard}>
                    <div className={styles.projectHeader}>
                      <div className={styles.projectName}>{project.name}</div>
                      <div className={styles.projectKey}>{project.key_prefix}</div>
                    </div>
                    <div className={styles.projectStats}>
                      <span>Total: {project.totalItems}</span>
                      <span>Abertos: {project.openItems}</span>
                      <span>Concluídos: {project.doneItems}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.recentSection}>
            <h2>Fila de Trabalho</h2>
            <div className={styles.itemList}>
              {recentItems.length === 0 ? (
                <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Nenhum item encontrado.</div>
              ) : (
                recentItems.map((item) => (
                  <div key={item.id} className={styles.itemRow}>
                    <div>
                      <strong style={{ color: 'var(--text-secondary)', marginRight: 10 }}>{item.project_key}</strong>
                      <span>{item.title}</span>
                    </div>
                    <div className={styles.itemStatus}>{item.workflow_status?.name || 'SEM STATUS'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {isCreateModalOpen && (
        <CreateItemModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
            queryClient.invalidateQueries({ queryKey: queryKeys.items });
          }}
        />
      )}
    </div>
  );
}


