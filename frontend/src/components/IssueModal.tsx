'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './modal.module.css';
import { itemsApi } from '@/lib/api/items';
import { queryKeys } from '@/lib/query/keys';
import type { Item, Priority } from '@/lib/types';

interface IssueModalProps {
  issue: Item | null;
  onClose: () => void;
  onUpdate?: () => void;
}

interface FormData {
  title: string;
  description: string;
  priority: Priority;
  workflow_status_id: string;
  parent_id: string;
}

export default function IssueModal({ issue, onClose, onUpdate }: IssueModalProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: issue?.title || '',
    description: issue?.description || '',
    priority: issue?.priority || 'MEDIUM',
    workflow_status_id: issue?.workflow_status_id || '',
    parent_id: issue?.parent_id || '',
  });

  const statusesQuery = useQuery({ queryKey: queryKeys.itemStatuses, queryFn: () => itemsApi.listStatuses() });

  const fetchType = issue?.type === 'STORY' ? 'EPIC' : (issue?.type === 'TASK' || issue?.type === 'BUG' ? 'STORY' : null);
  const parentCandidatesQuery = useQuery({
    queryKey: queryKeys.itemsByFilter(`${issue?.project_id || 'none'}:${fetchType || 'none'}`),
    queryFn: () => itemsApi.list({ project_id: issue?.project_id, type: fetchType || undefined }),
    enabled: Boolean(isEditing && issue?.project_id && fetchType),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!issue) throw new Error('Issue not selected');
      return itemsApi.update(issue.id, {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        workflow_status_id: formData.workflow_status_id,
        parent_id: formData.parent_id || null,
      });
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.items });
      if (issue?.project_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalItems(issue.project_id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(issue.project_id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
      if (onUpdate) onUpdate();
    },
    onError: (error: Error) => {
      alert(`Erro ao salvar as alterações: ${error.message}`);
    },
  });

  if (!issue) return null;

  const statusName = statusesQuery.data?.find(s => s.id === (isEditing ? formData.workflow_status_id : issue.workflow_status_id))?.name || issue.workflow_status?.name || '';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.issueKey}>{issue.project_key}</span>
            <span className={styles.separator}>/</span>
            <span className={styles.statusBadge}>{statusName}</span>
          </div>
          <div>
            {!isEditing ? (
              <button className="btn-secondary" style={{ marginRight: 10, padding: '4px 12px', fontSize: '0.85rem' }} onClick={() => setIsEditing(true)}>Editar</button>
            ) : (
              <button className="btn-primary" style={{ marginRight: 10, padding: '4px 12px', fontSize: '0.85rem' }} onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>
        </header>

        <div className={styles.modalBody}>
          <div className={styles.mainContent}>
            {!isEditing && issue.parent && (
              <div style={{ marginBottom: 15 }}>
                <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 4, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  Pertence a: <strong>{issue.parent.project_key} - {issue.parent.title}</strong>
                </span>
              </div>
            )}

            {isEditing ? (
              <input className="input-glass" style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: 20 }} value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} />
            ) : (
              <h1 className={styles.issueTitle}>{formData.title}</h1>
            )}

            <div className={styles.descriptionSection}>
              <h3>Descrição</h3>
              {isEditing ? (
                <textarea className="input-glass" rows={6} value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} />
              ) : (
                <div className={styles.descriptionText}>{formData.description || <span style={{ color: 'var(--text-dim)' }}>Sem detalhes ainda.</span>}</div>
              )}
            </div>

            {!isEditing && issue.children && issue.children.length > 0 && (
              <div style={{ marginTop: 30 }}>
                <h3>Sub-itens / Filhos ({issue.children.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  {issue.children.map((child) => (
                    <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>{child.project_key}</span>
                        <span style={{ fontSize: '0.9rem' }}>{child.title}</span>
                        <span style={{ fontSize: '0.75rem', padding: '1px 4px', borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>{child.type}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{child.workflow_status?.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className={styles.sidebar}>
            {isEditing ? (
              <>
                <div className={styles.sidebarField}>
                  <label>Status</label>
                  <select className="input-glass" value={formData.workflow_status_id} onChange={e => setFormData(prev => ({ ...prev, workflow_status_id: e.target.value }))}>
                    {(statusesQuery.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className={styles.sidebarField}>
                  <label>Prioridade</label>
                  <select className="input-glass" value={formData.priority} onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value as Priority }))}>
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>
                {(parentCandidatesQuery.data || []).length > 0 && (
                  <div className={styles.sidebarField}>
                    <label>Pai (Epic/Story)</label>
                    <select className="input-glass" value={formData.parent_id} onChange={e => setFormData(prev => ({ ...prev, parent_id: e.target.value }))}>
                      <option value="">Nenhum (Desvincular)</option>
                      {(parentCandidatesQuery.data || []).map(p => <option key={p.id} value={p.id}>{p.project_key} - {p.title}</option>)}
                    </select>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={styles.sidebarField}>
                  <label>Responsável</label>
                  <div className={styles.fieldValue}>{issue.assignee ? <><div className={styles.avatarMini}>{issue.assignee.name[0]}</div><span>{issue.assignee.name}</span></> : <span>Não atribuído</span>}</div>
                </div>
                <div className={styles.sidebarField}>
                  <label>Relator</label>
                  <div className={styles.fieldValue}>{issue.reporter ? <><div className={styles.avatarMini}>{issue.reporter.name[0]}</div><span>{issue.reporter.name}</span></> : <span>Sistema</span>}</div>
                </div>
                <div className={styles.sidebarField}>
                  <label>Prioridade</label>
                  <div className={styles.fieldValue}>{formData.priority}</div>
                </div>
              </>
            )}
            <div className={styles.sidebarField}>
              <label>Tipo</label>
              <div className={styles.fieldValue}>{issue.type}</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

