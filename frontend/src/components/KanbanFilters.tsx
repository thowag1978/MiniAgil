'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { savedViewsApi } from '@/lib/api/savedViews';
import { queryKeys } from '@/lib/query/keys';
import type { Item, KanbanFilters as FilterValues, Project, Sprint, Workflow } from '@/lib/types';
import styles from './kanbanFilters.module.css';

export default function KanbanFilters({
  project, workflows, sprints, epics, filters, onChange,
}: {
  project: Project;
  workflows: Workflow[];
  sprints: Sprint[];
  epics: Item[];
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
}) {
  const queryClient = useQueryClient();
  const [viewName, setViewName] = useState('');
  const [selectedViewId, setSelectedViewId] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [message, setMessage] = useState('');
  const viewsQuery = useQuery({ queryKey: queryKeys.savedViews(project.id), queryFn: () => savedViewsApi.list(project.id) });
  const saveMutation = useMutation({
    mutationFn: () => savedViewsApi.create(project.id, { name: viewName, filters, is_default: isDefault }),
    onSuccess: async () => { setViewName(''); setIsDefault(false); setMessage('Visualização salva.'); await queryClient.invalidateQueries({ queryKey: queryKeys.savedViews(project.id) }); },
    onError: (error: Error) => setMessage(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: savedViewsApi.remove,
    onSuccess: async () => { setMessage('Visualização removida.'); await queryClient.invalidateQueries({ queryKey: queryKeys.savedViews(project.id) }); },
    onError: (error: Error) => setMessage(error.message),
  });

  const statuses = workflows
    .filter((workflow) => workflow.item_type === 'TASK' || workflow.item_type === 'BUG')
    .flatMap((workflow) => workflow.statuses.map((status) => ({ ...status, itemType: workflow.item_type })));
  const members = project.members || [];
  const setSingle = (key: 'types' | 'status_ids' | 'priorities', value: string) => onChange({ ...filters, [key]: value ? [value] : undefined });
  const setValue = (key: keyof FilterValues, value: string | boolean | undefined) => onChange({ ...filters, [key]: value || undefined });

  return (
    <div className={styles.wrapper}>
      <div className={styles.filters}>
        <input aria-label="Pesquisar itens" placeholder="Pesquisar texto" value={filters.text || ''} onChange={(event) => setValue('text', event.target.value)} />
        <select aria-label="Filtrar por tipo" value={filters.types?.[0] || ''} onChange={(event) => setSingle('types', event.target.value)}><option value="">Todos os tipos</option><option value="TASK">Atividades</option><option value="BUG">Bugs</option></select>
        <select aria-label="Filtrar por status" value={filters.status_ids?.[0] || ''} onChange={(event) => setSingle('status_ids', event.target.value)}><option value="">Todos os status</option>{statuses.map((status) => <option key={status.id} value={status.id}>{status.name} · {status.itemType}</option>)}</select>
        <select aria-label="Filtrar por responsável" value={filters.assignee_id || ''} disabled={filters.unassigned} onChange={(event) => setValue('assignee_id', event.target.value)}><option value="">Todos os responsáveis</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.user?.name || member.user_id}</option>)}</select>
        <select aria-label="Filtrar por prioridade" value={filters.priorities?.[0] || ''} onChange={(event) => setSingle('priorities', event.target.value)}><option value="">Todas as prioridades</option><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select>
        <select aria-label="Filtrar por sprint" value={filters.sprint_id || ''} onChange={(event) => setValue('sprint_id', event.target.value)}><option value="">Sprint ativa</option>{sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select>
        <select aria-label="Filtrar por épico" value={filters.epic_id || ''} onChange={(event) => setValue('epic_id', event.target.value)}><option value="">Todos os épicos</option>{epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.project_key} · {epic.title}</option>)}</select>
        <label><input type="checkbox" checked={filters.unassigned || false} onChange={(event) => onChange({ ...filters, unassigned: event.target.checked || undefined, assignee_id: event.target.checked ? undefined : filters.assignee_id })} /> Sem responsável</label>
        <button type="button" onClick={() => onChange({})}>Limpar</button>
      </div>

      <div className={styles.savedViews}>
        <select aria-label="Visualizações salvas" value={selectedViewId} onChange={(event) => { setSelectedViewId(event.target.value); const view = viewsQuery.data?.find(({ id }) => id === event.target.value); if (view) onChange(view.filters); }}>
          <option value="">Visualizações salvas</option>{(viewsQuery.data || []).map((view) => <option key={view.id} value={view.id}>{view.is_default ? '★ ' : ''}{view.name}</option>)}
        </select>
        <input placeholder="Nome da visualização" value={viewName} onChange={(event) => setViewName(event.target.value)} />
        <label><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /> Padrão</label>
        <button type="button" disabled={!viewName.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>Salvar visualização</button>
        <button type="button" className={styles.danger} disabled={!selectedViewId || deleteMutation.isPending} onClick={() => { if (window.confirm('Remover a visualização selecionada?')) { deleteMutation.mutate(selectedViewId); setSelectedViewId(''); } }}>Remover</button>
        {message && <span>{message}</span>}
      </div>
    </div>
  );
}
