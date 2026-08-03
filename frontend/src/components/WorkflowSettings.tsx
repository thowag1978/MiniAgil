'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import { workflowsApi, type WorkflowStatusInput } from '@/lib/api/workflows';
import { queryKeys } from '@/lib/query/keys';
import type { ItemType, ProjectRole, WorkflowStatus } from '@/lib/types';
import styles from './workflowSettings.module.css';

const itemTypes: Array<{ value: ItemType; label: string }> = [
  { value: 'EPIC', label: 'Épicos' },
  { value: 'STORY', label: 'Histórias' },
  { value: 'TASK', label: 'Atividades' },
  { value: 'SUBTASK', label: 'Subtarefas' },
  { value: 'BUG', label: 'Bugs' },
];

const categories = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'] as const;

type Draft = { name: string; color: string; wipLimit: string; replacementId: string };

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível salvar a alteração.';
}

export default function WorkflowSettings({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [itemType, setItemType] = useState<ItemType>('TASK');
  const [drafts, setDrafts] = useState<Record<string, Partial<Draft>>>({});
  const [newStatus, setNewStatus] = useState({ name: '', color: '#64748B', category: 'TODO' as typeof categories[number] });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [newTransition, setNewTransition] = useState({
    from_status_id: '', to_status_id: '', allowed_role: '' as ProjectRole | '',
    requires_comment: false, requires_assignee: false,
  });

  const workflowQuery = useQuery({
    queryKey: queryKeys.projectWorkflow(projectId, itemType),
    queryFn: () => workflowsApi.getByType(projectId, itemType),
  });
  const workflow = workflowQuery.data;
  const statuses = useMemo(() => workflow?.statuses || [], [workflow?.statuses]);

  const getDraft = (status: WorkflowStatus): Draft => ({
      name: status.name,
      color: status.color || '#64748B',
      wipLimit: status.wip_limit?.toString() || '',
      replacementId: '',
      ...drafts[status.id],
  });

  const refreshConsumers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projectWorkflow(projectId, itemType) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projectWorkflows(projectId) }),
      queryClient.invalidateQueries({ queryKey: ['items', 'statuses'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.items }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: ({ statusId, input }: { statusId: string; input: WorkflowStatusInput }) => {
      if (!workflow) throw new Error('Workflow não carregado');
      return workflowsApi.updateStatus(projectId, workflow.id, statusId, input);
    },
    onSuccess: async (_data, variables) => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[variables.statusId];
        return next;
      });
      setFeedback('Alteração salva.');
      await refreshConsumers();
    },
    onError: (error) => setFeedback(errorMessage(error)),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!workflow) throw new Error('Workflow não carregado');
      return workflowsApi.createStatus(projectId, workflow.id, newStatus);
    },
    onSuccess: async () => {
      setNewStatus({ name: '', color: '#64748B', category: 'TODO' });
      setFeedback('Status criado.');
      await refreshConsumers();
    },
    onError: (error) => setFeedback(errorMessage(error)),
  });

  const reorderMutation = useMutation({
    mutationFn: (statusIds: string[]) => {
      if (!workflow) throw new Error('Workflow não carregado');
      return workflowsApi.reorderStatuses(projectId, workflow.id, statusIds);
    },
    onSuccess: async () => { setFeedback('Ordem atualizada.'); await refreshConsumers(); },
    onError: (error) => setFeedback(errorMessage(error)),
  });

  const createTransitionMutation = useMutation({
    mutationFn: () => {
      if (!workflow) throw new Error('Workflow não carregado');
      return workflowsApi.createTransition(projectId, workflow.id, {
        ...newTransition,
        allowed_role: newTransition.allowed_role || null,
      });
    },
    onSuccess: async () => {
      setNewTransition({ from_status_id: '', to_status_id: '', allowed_role: '', requires_comment: false, requires_assignee: false });
      setFeedback('Transição criada.');
      await refreshConsumers();
    },
    onError: (error) => setFeedback(errorMessage(error)),
  });

  const updateTransitionMutation = useMutation({
    mutationFn: ({ transitionId, input }: { transitionId: string; input: { allowed_role?: ProjectRole | null; requires_comment?: boolean; requires_assignee?: boolean; is_active?: boolean } }) => {
      if (!workflow) throw new Error('Workflow não carregado');
      return workflowsApi.updateTransition(projectId, workflow.id, transitionId, input);
    },
    onSuccess: async () => { setFeedback('Transição atualizada.'); await refreshConsumers(); },
    onError: (error) => setFeedback(errorMessage(error)),
  });

  const busy = updateMutation.isPending || createMutation.isPending || reorderMutation.isPending || createTransitionMutation.isPending || updateTransitionMutation.isPending;

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= statuses.length) return;
    const ids = statuses.map(({ id }) => id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  const saveDetails = (status: WorkflowStatus) => {
    const draft = getDraft(status);
    updateMutation.mutate({
      statusId: status.id,
      input: {
        name: draft.name,
        color: draft.color,
        wip_limit: draft.wipLimit === '' ? null : Number(draft.wipLimit),
      },
    });
  };

  const setFlag = (status: WorkflowStatus, field: 'is_initial' | 'is_final') => {
    const label = field === 'is_initial' ? 'inicial' : 'final';
    if (!window.confirm(`Confirmar este status como ${label}?`)) return;
    updateMutation.mutate({ statusId: status.id, input: { [field]: true } });
  };

  const toggleActive = (status: WorkflowStatus) => {
    if (status.is_active === false) {
      updateMutation.mutate({ statusId: status.id, input: { is_active: true } });
      return;
    }
    const draft = getDraft(status);
    const itemCount = status._count?.items || 0;
    if (itemCount > 0 && !draft?.replacementId) {
      setFeedback('Selecione um status substituto antes de desativar um status em uso.');
      return;
    }
    if (!window.confirm(`Desativar “${status.name}”${itemCount ? ` e mover ${itemCount} item(ns)` : ''}?`)) return;
    updateMutation.mutate({
      statusId: status.id,
      input: { is_active: false, replacement_status_id: draft?.replacementId || undefined },
    });
  };

  return (
    <section className={styles.panel} aria-labelledby="workflow-title">
      <div className={styles.heading}>
        <div>
          <h2 id="workflow-title">Configuração de workflows</h2>
          <p>Organize os status utilizados por cada tipo de item.</p>
        </div>
        {!canManage && <span className={styles.readOnly}>Somente leitura</span>}
      </div>

      <div className={styles.typeTabs} role="tablist" aria-label="Tipo de item">
        {itemTypes.map((type) => (
          <button key={type.value} type="button" className={itemType === type.value ? styles.activeTab : styles.tab} onClick={() => { setItemType(type.value); setFeedback(null); }}>
            {type.label}
          </button>
        ))}
      </div>

      {workflowQuery.isLoading ? (
        <div className={styles.state}>Carregando workflow...</div>
      ) : workflowQuery.isError ? (
        <div className={styles.error}>Não foi possível carregar o workflow. <button type="button" onClick={() => workflowQuery.refetch()}>Tentar novamente</button></div>
      ) : !workflow ? (
        <div className={styles.state}>Nenhum workflow configurado para este tipo.</div>
      ) : (
        <>
          <div className={styles.workflowName}>{workflow.name}</div>
          <div className={styles.statusList}>
            {statuses.map((status, index) => {
              const draft = getDraft(status);
              const itemCount = status._count?.items || 0;
              const replacements = statuses.filter((candidate) => candidate.id !== status.id && candidate.is_active !== false);
              return (
                <article key={status.id} className={`${styles.statusCard} ${status.is_active === false ? styles.inactive : ''}`}>
                  <div className={styles.orderControls}>
                    <button type="button" title="Mover para cima" disabled={!canManage || busy || index === 0} onClick={() => move(index, -1)}>↑</button>
                    <span>{index + 1}</span>
                    <button type="button" title="Mover para baixo" disabled={!canManage || busy || index === statuses.length - 1} onClick={() => move(index, 1)}>↓</button>
                  </div>

                  <div className={styles.statusFields}>
                    <label>Nome<input value={draft?.name || ''} disabled={!canManage || busy} onChange={(event) => setDrafts((current) => ({ ...current, [status.id]: { ...current[status.id], name: event.target.value } }))} /></label>
                    <label>Cor<input type="color" value={draft?.color || '#64748B'} disabled={!canManage || busy} onChange={(event) => setDrafts((current) => ({ ...current, [status.id]: { ...current[status.id], color: event.target.value } }))} /></label>
                    <label>Limite WIP<input type="number" min="1" placeholder="Sem limite" value={draft?.wipLimit || ''} disabled={!canManage || busy} onChange={(event) => setDrafts((current) => ({ ...current, [status.id]: { ...current[status.id], wipLimit: event.target.value } }))} /></label>
                  </div>

                  <div className={styles.badges}>
                    {status.is_initial && <span>Inicial</span>}
                    {status.is_final && <span>Final</span>}
                    {status.is_active === false && <span>Inativo</span>}
                    <span className={itemCount ? styles.inUse : undefined}>{itemCount ? `${itemCount} item(ns) em uso` : 'Não utilizado'}</span>
                  </div>

                  {canManage && (
                    <div className={styles.actions}>
                      <button type="button" disabled={busy} onClick={() => saveDetails(status)}>Salvar</button>
                      {!status.is_initial && status.is_active !== false && <button type="button" disabled={busy} onClick={() => setFlag(status, 'is_initial')}>Tornar inicial</button>}
                      {!status.is_final && status.is_active !== false && <button type="button" disabled={busy} onClick={() => setFlag(status, 'is_final')}>Marcar final</button>}
                      {status.is_active !== false && itemCount > 0 && (
                        <select aria-label={`Substituto para ${status.name}`} value={draft?.replacementId || ''} disabled={busy} onChange={(event) => setDrafts((current) => ({ ...current, [status.id]: { ...current[status.id], replacementId: event.target.value } }))}>
                          <option value="">Selecionar substituto</option>
                          {replacements.map((replacement) => <option key={replacement.id} value={replacement.id}>{replacement.name}</option>)}
                        </select>
                      )}
                      <button type="button" className={status.is_active === false ? undefined : styles.danger} disabled={busy} onClick={() => toggleActive(status)}>
                        {status.is_active === false ? 'Reativar' : 'Desativar'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {canManage && (
            <form className={styles.createForm} onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
              <h3>Novo status</h3>
              <input required placeholder="Nome do status" value={newStatus.name} onChange={(event) => setNewStatus((current) => ({ ...current, name: event.target.value }))} />
              <select value={newStatus.category} onChange={(event) => setNewStatus((current) => ({ ...current, category: event.target.value as typeof categories[number] }))}>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <input type="color" aria-label="Cor do novo status" value={newStatus.color} onChange={(event) => setNewStatus((current) => ({ ...current, color: event.target.value }))} />
              <button className="btn-primary" type="submit" disabled={busy}>Criar status</button>
            </form>
          )}

          <div className={styles.transitionsSection}>
            <div>
              <h3>Transições</h3>
              <p>Sem transições ativas, o workflow permanece permissivo.</p>
            </div>
            {(workflow.transitions || []).length === 0 ? (
              <div className={styles.state}>Nenhuma transição configurada.</div>
            ) : (
              <div className={styles.transitionList}>
                {(workflow.transitions || []).map((transition) => (
                  <div key={transition.id} className={`${styles.transitionCard} ${!transition.is_active ? styles.inactive : ''}`}>
                    <strong>{transition.fromStatus?.name || 'Origem'} → {transition.toStatus?.name || 'Destino'}</strong>
                    <label>Papel
                      <select disabled={!canManage || busy} value={transition.allowed_role || ''} onChange={(event) => updateTransitionMutation.mutate({ transitionId: transition.id, input: { allowed_role: (event.target.value || null) as ProjectRole | null } })}>
                        <option value="">Qualquer papel</option><option value="OWNER">OWNER</option><option value="ADMIN">ADMIN</option><option value="MEMBER">MEMBER</option><option value="VIEWER">VIEWER</option>
                      </select>
                    </label>
                    <label><input type="checkbox" disabled={!canManage || busy} checked={transition.requires_comment} onChange={(event) => updateTransitionMutation.mutate({ transitionId: transition.id, input: { requires_comment: event.target.checked } })} /> Exige comentário</label>
                    <label><input type="checkbox" disabled={!canManage || busy} checked={transition.requires_assignee} onChange={(event) => updateTransitionMutation.mutate({ transitionId: transition.id, input: { requires_assignee: event.target.checked } })} /> Exige responsável</label>
                    {canManage && <button type="button" disabled={busy} onClick={() => updateTransitionMutation.mutate({ transitionId: transition.id, input: { is_active: !transition.is_active } })}>{transition.is_active ? 'Desativar' : 'Ativar'}</button>}
                  </div>
                ))}
              </div>
            )}
            {canManage && (
              <form className={styles.transitionForm} onSubmit={(event) => { event.preventDefault(); createTransitionMutation.mutate(); }}>
                <select required value={newTransition.from_status_id} onChange={(event) => setNewTransition((current) => ({ ...current, from_status_id: event.target.value }))}>
                  <option value="">Status de origem</option>{statuses.filter((status) => status.is_active !== false).map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
                </select>
                <select required value={newTransition.to_status_id} onChange={(event) => setNewTransition((current) => ({ ...current, to_status_id: event.target.value }))}>
                  <option value="">Status de destino</option>{statuses.filter((status) => status.is_active !== false).map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
                </select>
                <select value={newTransition.allowed_role} onChange={(event) => setNewTransition((current) => ({ ...current, allowed_role: event.target.value as ProjectRole | '' }))}>
                  <option value="">Qualquer papel</option><option value="OWNER">OWNER</option><option value="ADMIN">ADMIN</option><option value="MEMBER">MEMBER</option><option value="VIEWER">VIEWER</option>
                </select>
                <label><input type="checkbox" checked={newTransition.requires_comment} onChange={(event) => setNewTransition((current) => ({ ...current, requires_comment: event.target.checked }))} /> Exigir comentário</label>
                <label><input type="checkbox" checked={newTransition.requires_assignee} onChange={(event) => setNewTransition((current) => ({ ...current, requires_assignee: event.target.checked }))} /> Exigir responsável</label>
                <button className="btn-primary" type="submit" disabled={busy}>Adicionar transição</button>
              </form>
            )}
          </div>
        </>
      )}

      {feedback && <div className={feedback.includes('Não') || feedback.includes('Selecione') ? styles.errorMessage : styles.success}>{feedback}</div>}
    </section>
  );
}
