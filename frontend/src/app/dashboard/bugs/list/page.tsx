'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import styles from '../bugs.module.css';
import { bugFeaturesApi, bugsApi, bugSystemsApi, type BugListFilters } from '@/lib/api/bugs';
import { usersApi } from '@/lib/api/users';
import { queryKeys } from '@/lib/query/keys';
import type { BugSeverity, BugStatus, Priority } from '@/lib/types';

type FilterState = {
  system_id: string;
  feature_id: string;
  status: BugStatus | '';
  severity: BugSeverity | '';
  priority: Priority | '';
  assignee_id: string;
  reporter_id: string;
  created_from: string;
  created_to: string;
};

const initialFilters: FilterState = {
  system_id: '',
  feature_id: '',
  status: '',
  severity: '',
  priority: '',
  assignee_id: '',
  reporter_id: '',
  created_from: '',
  created_to: '',
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

const levelLabels: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};

function buildFilterKey(filters: FilterState) {
  return JSON.stringify(filters);
}

function compactFilters(filters: FilterState): BugListFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '')
  ) as BugListFilters;
}

export default function BugsListPage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
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
    queryKey: queryKeys.bugs(filterKey),
    queryFn: () => bugsApi.list(compactFilters(filters)),
  });

  const updateFilter = (field: keyof FilterState, value: string) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      ...(field === 'system_id' ? { feature_id: '' } : {}),
    }));
  };

  return (
    <div className="animate-fade-in">
      <div className={styles.header}>
        <h1>Lista de Bugs</h1>
        <p>Consulta e triagem das ocorrencias registradas.</p>
      </div>

      <div className={styles.filterGrid}>
        <div className={styles.field}>
          <label htmlFor="filter-system">Sistema</label>
          <select id="filter-system" className="input-glass" value={filters.system_id} onChange={(event) => updateFilter('system_id', event.target.value)}>
            <option value="">Todos</option>
            {(systemsQuery.data || []).map((system) => (
              <option key={system.id} value={system.id}>{system.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-feature">Funcionalidade</label>
          <select id="filter-feature" className="input-glass" value={filters.feature_id} onChange={(event) => updateFilter('feature_id', event.target.value)}>
            <option value="">Todas</option>
            {(featuresQuery.data || []).map((feature) => (
              <option key={feature.id} value={feature.id}>{feature.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-status">Status</label>
          <select id="filter-status" className="input-glass" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-severity">Severidade</label>
          <select id="filter-severity" className="input-glass" value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)}>
            <option value="">Todas</option>
            {Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-priority">Prioridade</label>
          <select id="filter-priority" className="input-glass" value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
            <option value="">Todas</option>
            {Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-assignee">Responsavel</label>
          <select id="filter-assignee" className="input-glass" value={filters.assignee_id} onChange={(event) => updateFilter('assignee_id', event.target.value)}>
            <option value="">Todos</option>
            {(usersQuery.data || []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-reporter">Solicitante</label>
          <select id="filter-reporter" className="input-glass" value={filters.reporter_id} onChange={(event) => updateFilter('reporter_id', event.target.value)}>
            <option value="">Todos</option>
            {(usersQuery.data || []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-from">Periodo inicial</label>
          <input id="filter-from" className="input-glass" type="date" value={filters.created_from} onChange={(event) => updateFilter('created_from', event.target.value)} />
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-to">Periodo final</label>
          <input id="filter-to" className="input-glass" type="date" value={filters.created_to} onChange={(event) => updateFilter('created_to', event.target.value)} />
        </div>

        <div className={styles.actions}>
          <button className={styles.secondaryButton} type="button" onClick={() => setFilters(initialFilters)}>
            Limpar filtros
          </button>
        </div>
      </div>

      <div className={styles.table}>
        <div className={styles.bugsTableHeader}>
          <div>PROTOCOLO</div>
          <div>TITULO</div>
          <div>SISTEMA</div>
          <div>FUNCIONALIDADE</div>
          <div>SEVERIDADE</div>
          <div>PRIORIDADE</div>
          <div>STATUS</div>
          <div>RESPONSAVEL</div>
          <div>CRIADO EM</div>
        </div>

        {bugsQuery.isLoading ? (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Carregando bugs...</div>
        ) : bugsQuery.isError ? (
          <div style={{ padding: 24, color: '#ff8a8a' }}>Falha ao carregar bugs.</div>
        ) : (bugsQuery.data || []).length === 0 ? (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Nenhum bug encontrado.</div>
        ) : (
          (bugsQuery.data || []).map((bug) => (
            <div key={bug.id} className={styles.bugsTableRow}>
              <div className={styles.protocol}>
                <Link href={`/dashboard/bugs/${bug.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {bug.protocol}
                </Link>
              </div>
              <div className={styles.name}>{bug.title}</div>
              <div className={styles.muted}>{bug.system?.name || '-'}</div>
              <div className={styles.muted}>{bug.feature?.name || '-'}</div>
              <div>{levelLabels[bug.severity]}</div>
              <div>{levelLabels[bug.priority]}</div>
              <div>{statusLabels[bug.status]}</div>
              <div className={styles.muted}>{bug.assignee?.name || '-'}</div>
              <div className={styles.muted}>{new Date(bug.createdAt).toLocaleDateString('pt-BR')}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
