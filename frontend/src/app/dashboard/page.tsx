'use client';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './dashboard.module.css';
import CreateItemModal from '../../components/CreateItemModal';
import { itemsApi } from '@/lib/api/items';
import { queryKeys } from '@/lib/query/keys';
import { projectsApi } from '@/lib/api/projects';
import type { ItemType } from '@/lib/types';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState<ItemType | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const projectsQuery = useQuery({ queryKey: queryKeys.projects, queryFn: projectsApi.list });
  const projects = projectsQuery.data || [];
  const selectedProjectId = projects.some((project) => project.id === projectId) ? projectId : projects[0]?.id || '';

  const { data, isLoading, isError } = useQuery({
    queryKey: [...queryKeys.dashboardMetrics, selectedProjectId, type, startDate, endDate],
    queryFn: () => itemsApi.dashboardMetrics({ project_id: selectedProjectId, ...(type ? { type } : {}), ...(startDate ? { start_date: startDate } : {}), ...(endDate ? { end_date: `${endDate}T23:59:59.999Z` } : {}) }),
    enabled: Boolean(selectedProjectId),
  });
  const indicators = data?.metrics;
  const metricCards = indicators ? [
    ['ITENS TOTAIS', indicators.totalItems], ['CONCLUÍDOS', indicators.completedItems], ['EM ANDAMENTO', indicators.inProgressItems],
    ['VENCIDOS', indicators.overdueItems.value], ['SEM RESPONSÁVEL', indicators.unassignedItems], ['BUGS ABERTOS', indicators.openBugs],
    ['BUGS CRÍTICOS', indicators.criticalBugs], ['BUGS REABERTOS', indicators.reopenedBugs],
  ] : [];

  return (
    <div className="animate-fade-in">
      <div className={styles.dashHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Dashboard do Projeto</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Indicadores consolidados por categorias do workflow.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>+ Criar Item</button>
      </div>

      <div className={styles.dashboardFilters}>
        <select value={selectedProjectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Selecione o projeto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <select value={type} onChange={(event) => setType(event.target.value as ItemType | '')}><option value="">Todos os tipos</option><option value="EPIC">Épico</option><option value="STORY">História</option><option value="TASK">Atividade</option><option value="SUBTASK">Subtarefa</option><option value="BUG">Bug</option></select>
        <label>De <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>Até <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      </div>

      {projectsQuery.isLoading || isLoading ? (
        <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Carregando métricas...</div>
      ) : projectsQuery.isError || isError ? (
        <div style={{ padding: 16, color: '#ff6b6b' }}>Falha ao carregar dados do dashboard.</div>
      ) : !selectedProjectId ? (
        <div className={styles.emptyState}>Nenhum projeto disponível.</div>
      ) : (
        <>
          <div className={styles.metricsGrid}>
            {metricCards.map(([label, value]) => <div className={styles.metricCard} key={label}><div className={styles.metricTitle}>{label}</div><div className={styles.metricValue}>{value}</div>{label === 'VENCIDOS' && !indicators?.overdueItems.supported && <small title={indicators?.overdueItems.reason}>Prazo de item ainda indisponível</small>}</div>)}
          </div>

          <div className={styles.projectSection}>
            <h2>Sprint atual</h2>
            {data?.currentSprint ? <div className={styles.sprintCard}><strong>{data.currentSprint.name}</strong><span>{data.currentSprint.completedPoints} de {data.currentSprint.plannedPoints} pontos concluídos</span><progress max={Math.max(data.currentSprint.plannedPoints, 1)} value={data.currentSprint.completedPoints} /></div> : <div className={styles.emptyState}>Não há sprint ativa.</div>}
          </div>

          <div className={styles.recentSection}>
            <h2>Progresso dos épicos</h2>
            {!data?.epicProgress.length ? <div className={styles.emptyState}>Nenhum épico encontrado para os filtros.</div> : <div className={styles.epicList}>{data.epicProgress.map((epic) => <div key={epic.id} className={styles.epicRow}><div><strong>{epic.project_key} · {epic.title}</strong><span>{epic.completedItems} de {epic.totalItems} itens</span></div><progress max="100" value={epic.percentage} /><strong>{epic.percentage}%</strong></div>)}</div>}
          </div>
          <p className={styles.updatedAt}>Período: {data?.period.start ? new Date(data.period.start).toLocaleDateString('pt-BR') : 'todo o histórico'} até {data?.period.end ? new Date(data.period.end).toLocaleDateString('pt-BR') : 'agora'} · Atualizado em {data && new Date(data.updatedAt).toLocaleString('pt-BR')}</p>
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


