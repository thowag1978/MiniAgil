'use client';

import { DragEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from '../bugs.module.css';
import { bugFeaturesApi, bugsApi, bugSystemsApi, type BugListFilters } from '@/lib/api/bugs';
import { usersApi } from '@/lib/api/users';
import { queryKeys } from '@/lib/query/keys';
import type { Bug, BugSeverity, BugStatus, Priority } from '@/lib/types';

type FilterState = {
  system_id: string;
  feature_id: string;
  severity: BugSeverity | '';
  priority: Priority | '';
  assignee_id: string;
  environment: string;
};

type KanbanColumn = {
  id: string;
  label: string;
  targetStatus: BugStatus;
  statuses: BugStatus[];
};

const initialFilters: FilterState = {
  system_id: '',
  feature_id: '',
  severity: '',
  priority: '',
  assignee_id: '',
  environment: '',
};

const kanbanColumns: KanbanColumn[] = [
  {
    id: 'open',
    label: 'Aberto',
    targetStatus: 'OPEN',
    statuses: ['OPEN', 'TRIAGE', 'CONFIRMED', 'REOPENED'],
  },
  {
    id: 'in-fix',
    label: 'Em correcao',
    targetStatus: 'IN_FIX',
    statuses: ['IN_FIX'],
  },
  {
    id: 'waiting-validation',
    label: 'Aguardando validacao',
    targetStatus: 'WAITING_VALIDATION',
    statuses: ['WAITING_VALIDATION'],
  },
  {
    id: 'resolved',
    label: 'Resolvido',
    targetStatus: 'RESOLVED',
    statuses: ['RESOLVED', 'CLOSED'],
  },
  {
    id: 'finalized',
    label: 'Rejeitado / Duplicado / Cancelado',
    targetStatus: 'REJECTED',
    statuses: ['REJECTED', 'DUPLICATED', 'CANCELED'],
  },
];

const levelLabels: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};

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

const statusesRequiringComment = new Set<BugStatus>(['CLOSED', 'REOPENED', 'REJECTED', 'DUPLICATED', 'CANCELED']);

function buildFilterKey(filters: FilterState) {
  return JSON.stringify(filters);
}

function compactFilters(filters: FilterState): BugListFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '')
  ) as BugListFilters;
}

function sortBugs(a: Bug, b: Bug) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export default function BugsKanbanPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [draggedBugId, setDraggedBugId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const filterKey = useMemo(() => buildFilterKey(filters), [filters]);

  const systemsQuery = useQuery({
    queryKey: queryKeys.bugSystems,
    queryFn: () => bugSystemsApi.list(),
  });

  const featuresQuery = useQuery({
    queryKey: queryKeys.activeBugFeatures(filters.system_id || 'all'),
    queryFn: () => bugFeaturesApi.list({ system_id: filters.system_id || undefined }),
  });

  const usersQuery = useQuery({
    queryKey: queryKeys.users,
    queryFn: () => usersApi.list(),
  });

  const bugsQuery = useQuery({
    queryKey: queryKeys.bugsKanban(filterKey),
    queryFn: () => bugsApi.list(compactFilters(filters)),
  });

  const moveMutation = useMutation({
    mutationFn: ({ bug, status, comment }: { bug: Bug; status: BugStatus; comment?: string }) => bugsApi.updateStatus(bug.id, status, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bugsKanban(filterKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bugsDashboard });
    },
    onError: (error: Error) => alert(error.message),
  });

  const bugs = bugsQuery.data || [];

  const updateFilter = (field: keyof FilterState, value: string) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      ...(field === 'system_id' ? { feature_id: '' } : {}),
    }));
  };

  const moveBug = (column: KanbanColumn) => {
    const bug = bugs.find((item) => item.id === draggedBugId);
    setDraggedBugId(null);
    setOverColumnId(null);
    const targetStatus = column.targetStatus;
    if (!bug || bug.status === targetStatus) return;

    if (targetStatus === 'IN_FIX' && !bug.assignee_id) {
      alert('Para mover para Em correcao, atribua um responsavel ao bug.');
      return;
    }

    let comment: string | undefined;
    if (statusesRequiringComment.has(targetStatus)) {
      const input = prompt(`Informe um comentario para mover para ${column.label}:`);
      if (!input?.trim()) return;
      comment = input.trim();
    }

    moveMutation.mutate({ bug, status: targetStatus, comment });
  };

  const renderCard = (bug: Bug) => (
    <article
      key={bug.id}
      className={styles.bugCard}
      draggable
      onClick={() => router.push(`/dashboard/bugs/${bug.id}`)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        setDraggedBugId(bug.id);
      }}
    >
      <div className={styles.protocol}>{bug.protocol}</div>
      <div className={styles.bugCardTitle}>{bug.title}</div>
      <div className={styles.tagRow}>
        <span className={styles.badge}>{statusLabels[bug.status]}</span>
        <span className={styles.badge}>{levelLabels[bug.severity]}</span>
        <span className={styles.badge}>{levelLabels[bug.priority]}</span>
      </div>
      <div className={styles.bugCardFooter}>
        <span>{bug.system?.name || '-'}</span>
        <span>{bug.assignee?.name || 'Sem responsavel'}</span>
      </div>
      {bug.environment && <div className={styles.muted} style={{ marginTop: 8 }}>{bug.environment}</div>}
    </article>
  );

  const renderColumn = (column: KanbanColumn) => {
    const columnBugs = bugs.filter((bug) => column.statuses.includes(bug.status)).sort(sortBugs);
    return (
      <section
        key={column.id}
        className={`${styles.kanbanColumn} ${overColumnId === column.id ? styles.kanbanColumnOver : ''}`}
        onDragOver={(event: DragEvent<HTMLElement>) => {
          event.preventDefault();
          setOverColumnId(column.id);
        }}
        onDragLeave={() => setOverColumnId(null)}
        onDrop={() => moveBug(column)}
      >
        <div className={styles.kanbanColumnHeader}>
          <h2>{column.label}</h2>
          <span className={styles.badge}>{columnBugs.length}</span>
        </div>
        <div className={styles.kanbanContent}>
          {columnBugs.map(renderCard)}
        </div>
      </section>
    );
  };

  return (
    <div className={`animate-fade-in ${styles.kanbanWrapper}`}>
      <div className={styles.header}>
        <h1>Kanban de Bugs</h1>
        <p>Acompanhamento separado do ciclo de vida dos bugs.</p>
      </div>

      <div className={styles.filterGrid}>
        <div className={styles.field}>
          <label>Sistema</label>
          <select className="input-glass" value={filters.system_id} onChange={(event) => updateFilter('system_id', event.target.value)}>
            <option value="">Todos</option>
            {(systemsQuery.data || []).map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label>Funcionalidade</label>
          <select className="input-glass" value={filters.feature_id} onChange={(event) => updateFilter('feature_id', event.target.value)}>
            <option value="">Todas</option>
            {(featuresQuery.data || []).map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label>Severidade</label>
          <select className="input-glass" value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)}>
            <option value="">Todas</option>
            {Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label>Prioridade</label>
          <select className="input-glass" value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
            <option value="">Todas</option>
            {Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label>Responsavel</label>
          <select className="input-glass" value={filters.assignee_id} onChange={(event) => updateFilter('assignee_id', event.target.value)}>
            <option value="">Todos</option>
            {(usersQuery.data || []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label>Ambiente</label>
          <input className="input-glass" value={filters.environment} onChange={(event) => updateFilter('environment', event.target.value)} placeholder="Producao, homologacao..." />
        </div>
        <div className={styles.actions}>
          <button className={styles.secondaryButton} type="button" onClick={() => setFilters(initialFilters)}>Limpar filtros</button>
        </div>
      </div>

      {bugsQuery.isLoading ? (
        <div style={{ padding: 20, color: 'var(--text-secondary)' }}>Carregando Kanban de bugs...</div>
      ) : bugsQuery.isError ? (
        <div style={{ padding: 20, color: '#ff8a8a' }}>Falha ao carregar Kanban de bugs.</div>
      ) : (
        <div className={styles.kanbanColumns}>{kanbanColumns.map(renderColumn)}</div>
      )}
    </div>
  );
}
