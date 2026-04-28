'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './modal.module.css';
import { itemsApi, type CreateItemInput, type UpdateItemInput } from '@/lib/api/items';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import { queryKeys } from '@/lib/query/keys';
import type { Item, ItemType, Priority } from '@/lib/types';

interface HierarchicalItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
  mode: 'CREATE' | 'EDIT';
  type: 'EPIC' | 'STORY' | 'TASK';
  projectData?: { id: string; name: string; key_prefix: string };
  parentData?: { id: string; title: string; project_key: string; project_id: string };
  initialData?: Item;
}

interface FormData {
  title: string;
  description: string;
  priority: Priority;
  project_id: string;
  workflow_status_id: string;
  assignee_id: string;
  parent_id: string;
  acceptance_criteria: string;
  estimate: string;
}

export default function HierarchicalItemModal({ onClose, onSuccess, mode, type, projectData, parentData, initialData }: HierarchicalItemModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    priority: initialData?.priority || 'MEDIUM',
    project_id: initialData?.project_id || projectData?.id || parentData?.project_id || '',
    workflow_status_id: initialData?.workflow_status_id || '',
    assignee_id: initialData?.assignee_id || '',
    parent_id: initialData?.parent_id || parentData?.id || '',
    acceptance_criteria: initialData?.acceptance_criteria || '',
    estimate: initialData?.estimate ? String(initialData.estimate) : '',
  });

  const usersQuery = useQuery({ queryKey: queryKeys.users, queryFn: () => usersApi.list() });
  const statusesQuery = useQuery({ queryKey: queryKeys.itemStatuses, queryFn: () => itemsApi.listStatuses() });
  const projectsQuery = useQuery({ queryKey: queryKeys.projects, queryFn: () => projectsApi.list(), enabled: mode === 'CREATE' });

  const resolvedProjectId = formData.project_id || projectsQuery.data?.[0]?.id || '';
  const resolvedWorkflowStatusId = formData.workflow_status_id || statusesQuery.data?.find(s => s.name === 'A FAZER' || s.order === 0)?.id || statusesQuery.data?.[0]?.id || '';

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'CREATE') {
        const payload: CreateItemInput = {
          type,
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          project_id: resolvedProjectId,
          workflow_status_id: resolvedWorkflowStatusId,
          assignee_id: formData.assignee_id || null,
          parent_id: formData.parent_id || null,
        };

        if (type === 'STORY') payload.acceptance_criteria = formData.acceptance_criteria;
        if (type === 'TASK') payload.estimate = formData.estimate || null;

        return itemsApi.create(payload);
      }

      if (!initialData) throw new Error('Item invalido');

      const payload: UpdateItemInput = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        workflow_status_id: resolvedWorkflowStatusId,
        assignee_id: formData.assignee_id || null,
        parent_id: formData.parent_id || null,
      };

      if (type === 'STORY') payload.acceptance_criteria = formData.acceptance_criteria;
      if (type === 'TASK') payload.estimate = formData.estimate || null;

      return itemsApi.update(initialData.id, payload);
    },
    onSuccess: () => {
      if (resolvedProjectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalItems(resolvedProjectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(resolvedProjectId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalTree });
      queryClient.invalidateQueries({ queryKey: queryKeys.items });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
      onSuccess();
    },
    onError: (error: Error) => {
      alert(`Erro ao salvar: ${error.message}`);
    },
  });

  const handleChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert('O titulo e obrigatorio.');
      return;
    }
    if (mode === 'CREATE' && !resolvedProjectId) {
      alert('Projeto nao encontrado.');
      return;
    }
    mutation.mutate();
  };

  const initialDataLoading = usersQuery.isLoading || statusesQuery.isLoading || (mode === 'CREATE' && projectsQuery.isLoading);

  const titlePrefix = mode === 'CREATE' ? 'Criar Nova' : 'Editar';
  const typeLabels: Record<ItemType | 'BUG', string> = { EPIC: 'Epico', STORY: 'Historia', TASK: 'Atividade', SUBTASK: 'Subtask', BUG: 'Bug' };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{titlePrefix} {typeLabels[type]}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>x</button>
        </header>

        <div className={styles.modalBody} style={{ flexDirection: 'column', gap: 20 }}>
          {initialDataLoading ? (
            <div style={{ color: 'var(--text-dim)' }}>Carregando configuracao...</div>
          ) : (
            <>
              {projectData && mode === 'CREATE' && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: 8, fontSize: '0.9rem', color: 'var(--text-dim)' }}>
                  <strong>Projeto:</strong> {projectData.key_prefix} - {projectData.name}
                </div>
              )}

              {parentData && mode === 'CREATE' && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: 8, fontSize: '0.9rem', color: 'var(--text-dim)' }}>
                  <strong>Pai vinculado:</strong> {parentData.project_key} - {parentData.title}
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Titulo <span style={{ color: 'red' }}>*</span></label>
                <input className="input-glass" placeholder="Resumo do item..." value={formData.title} onChange={e => handleChange('title', e.target.value)} style={{ width: '100%', fontSize: '1.1rem', padding: '10px 15px' }} />
              </div>

              <div style={{ display: 'flex', gap: 15 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Status</label>
                  <select className="input-glass" value={resolvedWorkflowStatusId} onChange={e => handleChange('workflow_status_id', e.target.value)} style={{ width: '100%' }}>
                    {(statusesQuery.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Prioridade</label>
                  <select className="input-glass" value={formData.priority} onChange={e => handleChange('priority', e.target.value as Priority)} style={{ width: '100%' }}>
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Critica</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 15 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Responsavel</label>
                  <select className="input-glass" value={formData.assignee_id} onChange={e => handleChange('assignee_id', e.target.value)} style={{ width: '100%' }}>
                    <option value="">Nao atribuido</option>
                    {(usersQuery.data || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                {type === 'TASK' && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Estimativa (Pts)</label>
                    <input type="number" className="input-glass" value={formData.estimate} onChange={e => handleChange('estimate', e.target.value)} style={{ width: '100%' }} />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Descricao</label>
                <textarea className="input-glass" placeholder="Adicione detalhes..." rows={4} value={formData.description} onChange={e => handleChange('description', e.target.value)} style={{ width: '100%', padding: '10px 15px' }} />
              </div>

              {type === 'STORY' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Criterio de Aceite</label>
                  <textarea className="input-glass" placeholder="Regras para aprovacao desta historia..." rows={3} value={formData.acceptance_criteria} onChange={e => handleChange('acceptance_criteria', e.target.value)} style={{ width: '100%', padding: '10px 15px' }} />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                <button className="btn-primary" onClick={handleSave} disabled={mutation.isPending || (mode === 'CREATE' && !resolvedProjectId)}>
                  {mutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
