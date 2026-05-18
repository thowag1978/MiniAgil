'use client';

import { useQuery } from '@tanstack/react-query';
import styles from './bugs.module.css';
import { bugsApi } from '@/lib/api/bugs';
import { queryKeys } from '@/lib/query/keys';
import type { BugStatus } from '@/lib/types';

const statusLabels: Record<BugStatus, string> = {
  OPEN: 'Aberto',
  TRIAGE: 'Em triagem',
  CONFIRMED: 'Confirmado',
  IN_FIX: 'Em correcao',
  WAITING_VALIDATION: 'Aguardando validacao',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  REOPENED: 'Reaberto',
  REJECTED: 'Rejeitado',
  DUPLICATED: 'Duplicado',
  CANCELED: 'Cancelado',
};

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
}

function SimpleTable({ title, rows }: { title: string; rows: Array<{ label: string; total: number }> }) {
  return (
    <section className={styles.panel}>
      <h2>{title}</h2>
      <div className={styles.stack}>
        {rows.length === 0 ? (
          <div className={styles.muted}>Sem dados.</div>
        ) : rows.map((row) => (
          <div key={row.label} className={styles.tableRow} style={{ gridTemplateColumns: '1fr auto', padding: '10px 0' }}>
            <div className={styles.muted}>{row.label}</div>
            <div className={styles.name}>{row.total}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BugsDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: queryKeys.bugsDashboard,
    queryFn: () => bugsApi.dashboard(),
  });

  const data = dashboardQuery.data;

  return (
    <div className="animate-fade-in">
      <div className={styles.header}>
        <h1>Painel de Bugs</h1>
        <p>Visao consolidada para acompanhamento de bugs.</p>
      </div>

      {dashboardQuery.isLoading ? (
        <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Carregando indicadores...</div>
      ) : dashboardQuery.isError || !data ? (
        <div style={{ padding: 24, color: '#ff8a8a' }}>Falha ao carregar indicadores de bugs.</div>
      ) : (
        <>
          <div className={styles.metricsGrid}>
            <MetricCard label="Bugs abertos" value={data.totalOpen} />
            <MetricCard label="Bugs criticos" value={data.critical} />
            <MetricCard label="Bugs reabertos" value={data.reopened} />
            <MetricCard
              label="Tempo medio de resolucao"
              value={data.averageResolutionHours === null ? '-' : `${data.averageResolutionHours}h`}
            />
          </div>

          <div className={styles.dashboardGrid}>
            <SimpleTable
              title="Bugs por sistema"
              rows={data.bySystem.map((item) => ({ label: item.name, total: item.total }))}
            />
            <SimpleTable
              title="Bugs por status"
              rows={data.byStatus.map((item) => ({ label: statusLabels[item.status], total: item.total }))}
            />
            <SimpleTable
              title="Bugs por responsavel"
              rows={data.byAssignee.map((item) => ({ label: item.name, total: item.total }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
