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

interface ItemFormData {
  type: ItemType;
  title: string;
  description: string;
  priority: Priority;
  project_id: string;
  workflow_status_id: string;
  parent_id: string;
}

interface ProjectFormData {
  id: string;
  name: string;
  key_prefix: string;
  description: string;
}

export default function CreateItemModal({ onClose, onSuccess }: CreateItemModalProps) {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState<'ITEM' | 'PROJECT'>('ITEM');
  const [projectMode, setProjectMode] = useState<'CREATE' | 'EDIT'>('CREATE');

  const [itemForm, setItemForm] = useState<ItemFormData>({
    type: 'TASK',
    title: '',
    description: '',
    priority: 'MEDIUM',
    project_id: '',
    workflow_status_id: '',
    parent_id: '',
  });

  const [projectForm, setProjectForm] = useState<ProjectFormData>({
    id: '',
    name: '',
    key_prefix: '',
    description: '',
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
  });

  const statusesQuery = useQuery({
    queryKey: queryKeys.itemStatuses,
    queryFn: () => itemsApi.listStatuses(),
    enabled: entityType === 'ITEM',
  });

  const selectedProjectId = itemForm.project_id || projectsQuery.data?.[0]?.id || '';
  const parentType = useMemo(() => {
    if (itemForm.type === 'STORY') return 'EPIC';
    if (itemForm.type === 'TASK' || itemForm.type === 'BUG') return 'STORY';
    return null;
  }, [itemForm.type]);

  const potentialParentsQuery = useQuery({
    queryKey: queryKeys.itemsByFilter(`${selectedProjectId}:${parentType || 'none'}`),
    queryFn: () => itemsApi.list({ project_id: selectedProjectId, type: parentType as ItemType }),
    enabled: entityType === 'ITEM' && Boolean(selectedProjectId && parentType),
  });

  const createItemMutation = useMutation({
    mutationFn: (payload: CreateItemInput) => itemsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalTree });
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(selectedProjectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalItems(selectedProjectId) });
      }
      onSuccess();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar item: ${error.message}`);
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (payload: { name: string; key_prefix: string; description?: string }) => projectsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalTree });
      onSuccess();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar projeto: ${error.message}`);
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; key_prefix: string; description?: string }) =>
      projectsApi.update(payload.id, {
        name: payload.name,
        key_prefix: payload.key_prefix,
        description: payload.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalTree });
      onSuccess();
    },
    onError: (error: Error) => {
      alert(`Erro ao editar projeto: ${error.message}`);
    },
  });

  React.useEffect(() => {
    if (!itemForm.project_id && projectsQuery.data?.[0]?.id) {
      setItemForm((prev) => ({ ...prev, project_id: projectsQuery.data![0].id }));
    }
  }, [projectsQuery.data, itemForm.project_id]);

  React.useEffect(() => {
    if (!itemForm.workflow_status_id && statusesQuery.data?.length) {
      const startStatus = statusesQuery.data.find((s) => s.name === 'A FAZER' || s.order === 0) || statusesQuery.data[0];
      setItemForm((prev) => ({ ...prev, workflow_status_id: startStatus.id }));
    }
  }, [statusesQuery.data, itemForm.workflow_status_id]);

  React.useEffect(() => {
    if (!parentType) {
      setItemForm((prev) => ({ ...prev, parent_id: '' }));
    }
  }, [parentType]);

  React.useEffect(() => {
    if (projectMode === 'EDIT' && projectForm.id && projectsQuery.data) {
      const selected = projectsQuery.data.find((p) => p.id === projectForm.id);
      if (selected) {
        setProjectForm({
          id: selected.id,
          name: selected.name,
          key_prefix: selected.key_prefix,
          description: selected.description || '',
        });
      }
    }
  }, [projectMode, projectForm.id, projectsQuery.data]);

  const handleItemSave = () => {
    if (!itemForm.title.trim()) {
      alert('O título é obrigatório.');
      return;
    }
    if (!selectedProjectId || !itemForm.workflow_status_id) {
      alert('Projeto e status são obrigatórios.');
      return;
    }

    const payload: CreateItemInput = {
      type: itemForm.type,
      title: itemForm.title,
      description: itemForm.description,
      priority: itemForm.priority,
      project_id: selectedProjectId,
      workflow_status_id: itemForm.workflow_status_id,
      parent_id: itemForm.parent_id || null,
    };

    if (!payload.parent_id) delete payload.parent_id;
    createItemMutation.mutate(payload);
  };

  const handleProjectSave = () => {
    if (!projectForm.name.trim() || !projectForm.key_prefix.trim()) {
      alert('Nome e chave do projeto são obrigatórios.');
      return;
    }

    const payload = {
      name: projectForm.name.trim(),
      key_prefix: projectForm.key_prefix.toUpperCase().trim(),
      description: projectForm.description.trim() || undefined,
    };

    if (projectMode === 'CREATE') {
      createProjectMutation.mutate(payload);
      return;
    }

    if (!projectForm.id) {
      alert('Selecione um projeto para editar.');
      return;
    }
    updateProjectMutation.mutate({ id: projectForm.id, ...payload });
  };

  const isItemLoading = entityType === 'ITEM' && (projectsQuery.isLoading || statusesQuery.isLoading);
  const projectActionPending = createProjectMutation.isPending || updateProjectMutation.isPending;
  const potentialParents = (potentialParentsQuery.data || []) as Item[];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Novo Item</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </header>

        <div className={styles.modalBody} style={{ flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={entityType === 'ITEM' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setEntityType('ITEM')}
              type="button"
            >
              Item
            </button>
            <button
              className={entityType === 'PROJECT' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setEntityType('PROJECT')}
              type="button"
            >
              Projeto
            </button>
          </div>

          {entityType === 'ITEM' ? (
            isItemLoading ? (
              <div style={{ color: 'var(--text-dim)' }}>Carregando configuração...</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Tipo</label>
                    <select
                      className="input-glass"
                      value={itemForm.type}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, type: e.target.value as ItemType }))}
                      style={{ width: '100%' }}
                    >
                      <option value="EPIC">Épico</option>
                      <option value="STORY">História de Usuário</option>
                      <option value="TASK">Tarefa</option>
                      <option value="BUG">Bug</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Projeto</label>
                    <select
                      className="input-glass"
                      value={itemForm.project_id}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, project_id: e.target.value, parent_id: '' }))}
                      style={{ width: '100%' }}
                    >
                      {(projectsQuery.data || []).map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.key_prefix} - {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Prioridade</label>
                    <select
                      className="input-glass"
                      value={itemForm.priority}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, priority: e.target.value as Priority }))}
                      style={{ width: '100%' }}
                    >
                      <option value="LOW">Baixa</option>
                      <option value="MEDIUM">Média</option>
                      <option value="HIGH">Alta</option>
                      <option value="CRITICAL">Crítica</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Status Inicial</label>
                    <select
                      className="input-glass"
                      value={itemForm.workflow_status_id}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, workflow_status_id: e.target.value }))}
                      style={{ width: '100%' }}
                    >
                      {(statusesQuery.data || []).map((status) => (
                        <option key={status.id} value={status.id}>{status.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {parentType && potentialParents.length > 0 && (
                  <div>
                    <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                      {itemForm.type === 'STORY' ? 'Épico Pai' : 'História Pai'}
                    </label>
                    <select
                      className="input-glass"
                      value={itemForm.parent_id}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, parent_id: e.target.value }))}
                      style={{ width: '100%' }}
                    >
                      <option value="">Nenhum (item solto)</option>
                      {potentialParents.map((p) => (
                        <option key={p.id} value={p.id}>{p.project_key} - {p.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Título</label>
                  <input
                    className="input-glass"
                    value={itemForm.title}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Resumo do item..."
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Descrição</label>
                  <textarea
                    className="input-glass"
                    rows={5}
                    value={itemForm.description}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Detalhes do item..."
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                  <button className="btn-primary" onClick={handleItemSave} disabled={createItemMutation.isPending || !selectedProjectId}>
                    {createItemMutation.isPending ? 'Salvando...' : 'Criar Item'}
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={projectMode === 'CREATE' ? 'btn-primary' : 'btn-secondary'}
                  type="button"
                  onClick={() => {
                    setProjectMode('CREATE');
                    setProjectForm({ id: '', name: '', key_prefix: '', description: '' });
                  }}
                >
                  Criar Projeto
                </button>
                <button
                  className={projectMode === 'EDIT' ? 'btn-primary' : 'btn-secondary'}
                  type="button"
                  onClick={() => {
                    setProjectMode('EDIT');
                    const first = projectsQuery.data?.[0];
                    setProjectForm({
                      id: first?.id || '',
                      name: first?.name || '',
                      key_prefix: first?.key_prefix || '',
                      description: first?.description || '',
                    });
                  }}
                >
                  Editar Projeto
                </button>
              </div>

              {projectMode === 'EDIT' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Projeto</label>
                  <select
                    className="input-glass"
                    value={projectForm.id}
                    onChange={(e) => setProjectForm((prev) => ({ ...prev, id: e.target.value }))}
                    style={{ width: '100%' }}
                  >
                    <option value="">Selecione um projeto</option>
                    {(projectsQuery.data || []).map((project) => (
                      <option key={project.id} value={project.id}>{project.key_prefix} - {project.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nome do Projeto</label>
                <input
                  className="input-glass"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Plataforma Mobile"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Chave do Projeto</label>
                <input
                  className="input-glass"
                  value={projectForm.key_prefix}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, key_prefix: e.target.value.toUpperCase() }))}
                  maxLength={10}
                  placeholder="Ex: MOB"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Descrição</label>
                <textarea
                  className="input-glass"
                  rows={5}
                  value={projectForm.description}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição do projeto..."
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                <button
                  className="btn-primary"
                  onClick={handleProjectSave}
                  disabled={projectActionPending || (projectMode === 'EDIT' && !projectForm.id)}
                >
                  {projectActionPending ? 'Salvando...' : projectMode === 'CREATE' ? 'Criar Projeto' : 'Salvar Projeto'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
