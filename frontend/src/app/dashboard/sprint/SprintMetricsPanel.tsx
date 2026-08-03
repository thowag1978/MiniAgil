import type { SprintMetrics, SprintVelocity } from '@/lib/types';
import styles from './sprint.module.css';

function Burndown({ metrics }: { metrics: SprintMetrics }) {
  const values = metrics.snapshots;
  if (!values.length) return <p className={styles.emptyMetric}>O gráfico será iniciado quando a sprint começar.</p>;
  const max = Math.max(...values.map((point) => point.scope_points), 1);
  const width = 600;
  const points = values.map((point, index) => `${values.length === 1 ? 0 : (index / (values.length - 1)) * width},${120 - (point.remaining_points / max) * 110}`).join(' ');
  return <svg className={styles.burndown} viewBox={`0 0 ${width} 130`} role="img" aria-label="Pontos restantes por dia">
    <line x1="0" y1="10" x2={width} y2="120" className={styles.idealLine} />
    <polyline points={points} className={styles.actualLine} />
  </svg>;
}

export function SprintMetricsPanel({ metrics, velocity, loading }: { metrics?: SprintMetrics; velocity?: SprintVelocity[]; loading: boolean }) {
  if (loading) return <section className={styles.metricsPanel}>Carregando indicadores…</section>;
  if (!metrics) return null;
  const cards = [
    ['Planejados', metrics.summary.plannedPoints], ['Concluídos', metrics.summary.completedPoints],
    ['Adicionados', metrics.summary.addedPoints], ['Retirados', metrics.summary.removedPoints],
    ['Restantes', metrics.summary.remainingPoints], ['Conclusão', `${metrics.summary.completionPercentage}%`],
  ];
  return <section className={styles.metricsPanel}>
    <h2>Indicadores da sprint</h2>
    <div className={styles.metricCards}>{cards.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <h3>Burndown</h3>
    <Burndown metrics={metrics} />
    <p className={styles.metricNote}>Conclusão: status na categoria DONE. Histórias sem pontos valem {metrics.calculation.unestimatedStoryFallbackPoints} ponto para estes indicadores.</p>
    <h3>Mudanças de escopo</h3>
    {metrics.scopeChanges.length === 0 ? <p className={styles.emptyMetric}>Nenhuma mudança após o início.</p> : <ul className={styles.scopeChanges}>{metrics.scopeChanges.map((change) => <li key={change.id}><strong>{change.change_type === 'ADDED' ? 'Adicionado' : 'Retirado'}:</strong> {change.item_key} · {change.item_title} ({change.points} pt) por {change.user.name}, em {new Date(change.createdAt).toLocaleDateString('pt-BR')}</li>)}</ul>}
    <h3>Velocity</h3>
    {!velocity?.length ? <p className={styles.emptyMetric}>Ainda não há sprints concluídas.</p> : <div className={styles.velocity}>{velocity.map((entry) => <div key={entry.sprintId}><span>{entry.name}</span><strong>{entry.completedPoints}</strong><small>de {entry.plannedPoints} planejados</small></div>)}</div>}
  </section>;
}
