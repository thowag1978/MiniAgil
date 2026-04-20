'use client';
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './modal.module.css';
import { itemsApi, type CreateItemInput } from '@/lib/api/items';
import { projectsApi } from '@/lib/api/projects';
import { queryKeys } from '@/lib/query/keys';
import type { Item, ItemType, Priority } from '@/lib/types';

interface CreateItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  type: ItemType;
  title: string;
  description: string;
  priority: Priority;
  project_id: string;
  workflow_status_id: string;
  parent_id: string;
}

export default function CreateItemModal({ onClose, onSuccess }: CreateItemModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({
    type: 'TASK',
    title: '',
    description: '',
    priority: 'MEDIUM',
    project_id: '',
    workflow_status_id: '',
    parent_id: '',
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
  });

  const statusesQuery = useQuery({
    queryKey: queryKeys.itemStatuses,
    queryFn: () => itemsApi.listStatuses(),
  });

  const selectedProjectId = formData.project_id || projectsQuery.data?.[0]?.id || '';
  const parentType = useMemo(() => {
    if (formData.type === 'STORY') return 'EPIC';
    if (formData.type === 'TASK' || formData.type === 'BUG') return 'STORY';
    return null;
  }, [formData.type]);

  const potentialParentsQuery = useQuery({
    queryKey: queryKeys.itemsByFilter(`${selectedProjectId}:${parentType || 'none'}`),
    queryFn: () => itemsApi.list({ project_id: selectedProjectId, type: parentType as ItemType }),
    enabled: Boolean(selectedProjectId && parentType),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateItemInput) => itemsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(selectedProjectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalItems(selectedProjectId) });
      }
      onSuccess();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar: ${error.message}`);
    },
  });

  const initialDataLoading = projectsQuery.isLoading || statusesQuery.isLoading;

  React.useEffect(() => {
    if (!formData.project_id && projectsQuery.data?.[0]?.id) {
      setFormData(prev => ({ ...prev, project_id: projectsQuery.data[0].id }));
    }
  }, [projectsQuery.data, formData.project_id]);

  React.useEffect(() => {
    if (!formData.workflow_status_id && statusesQuery.data?.length) {
      const startStatus = statusesQuery.data.find(s => s.name === 'A FAZER' || s.order === 0) || statusesQuery.data[0];
      setFormData(prev => ({ ...prev, workflow_status_id: startStatus.id }));
    }
  }, [statusesQuery.data, formData.workflow_status_id]);

  React.useEffect(() => {
    if (!parentType) {
      setFormData(prev => ({ ...prev, parent_id: '' }));
    }
  }, [parentType]);

  const handleChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert('O título é obrigatório.');
      return;
    }
    if (!selectedProjectId || !formData.workflow_status_id) {
      alert('Projeto e status são obrigatórios.');
      return;
    }

    const payload: CreateItemInput = {
      type: formData.type,
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      project_id: selectedProjectId,
      workflow_status_id: formData.workflow_status_id,
      parent_id: formData.parent_id || null,
    };

    if (!payload.parent_id) delete payload.parent_id;

    createMutation.mutate(payload);
  };

  const potentialParents = (potentialParentsQuery.data || []) as Item[];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Criar Nova Atividade</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </header>

        <div className={styles.modalBody} style={{ flexDirection: 'column', gap: 20 }}>
          {initialDataLoading ? (
            <div style={{ color: 'var(--text-dim)' }}>Carregando configuração...</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 15 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Tipo de Tarefa</label>
                  <select
                    className="input-glass"
                    value={formData.type}
                    onChange={e => handleChange('type', e.target.value as ItemType)}
                    style={{ width: '100%' }}
                  >
                    <option value="EPIC">Épico</option>
                    <option value="STORY">História de Usuário</option>
                    <option value="TASK">Tarefa</option>
                    <option value="BUG">Bug</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Prioridade</label>
                  <select
                    className="input-glass"
                    value={formData.priority}
                    onChange={e => handleChange('priority', e.target.value as Priority)}
                    style={{ width: '100%' }}
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>
              </div>

              {parentType && potentialParents.length > 0 && (
                <div>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                    {formData.type === 'STORY' ? 'Épico Pai' : 'História Pai'} {potentialParentsQuery.isLoading && '(Carregando...)'}
                  </label>
                  <select
                    className="input-glass"
                    value={formData.parent_id}
                    onChange={e => handleChange('parent_id', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Nenhum (Item solto)</option>
                    {potentialParents.map(p => (
                      <option key={p.id} value={p.id}>{p.project_key} - {p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Título</label>
                <input
                  className="input-glass"
                  placeholder="Resumo do item..."
                  value={formData.title}
                  onChange={e => handleChange('title', e.target.value)}
                  style={{ width: '100%', fontSize: '1.1rem', padding: '10px 15px' }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Descrição</label>
                <textarea
                  className="input-glass"
                  placeholder="Adicione detalhes, critérios de aceite, passos para reproduzir..."
                  rows={6}
                  value={formData.description}
                  onChange={e => handleChange('description', e.target.value)}
                  style={{ width: '100%', padding: '10px 15px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                <button className="btn-primary" onClick={handleSave} disabled={createMutation.isPending || !selectedProjectId}>
                  {createMutation.isPending ? 'Salvando...' : 'Criar Atividade'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


