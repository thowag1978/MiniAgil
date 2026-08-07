'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './modal.module.css';
import { itemsApi } from '@/lib/api/items';
import { queryKeys } from '@/lib/query/keys';
import type { BugDetails, BugEnvironment, BugOrigin, BugReproducibility, BugSeverity, Item, Priority } from '@/lib/types';
import ItemComments from './ItemComments';
import ItemHistory from './ItemHistory';
import ItemAttachments from './ItemAttachments';
import BugRetests from './BugRetests';
import ItemCodeLinks from './ItemCodeLinks';
import CustomFieldInputs from './CustomFieldInputs';
import { customFieldsApi } from '@/lib/api/customFields';
import type { CustomFieldInputValue } from '@/lib/types';

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
  transition_comment: string;
  bug_details: Partial<BugDetails>;
  custom_fields: Record<string, CustomFieldInputValue>;
  story_points: string;
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
    transition_comment: '',
    bug_details: issue?.bug_details || {
      severity: 'MEDIUM', environment: 'TEST', origin: 'DEVELOPMENT', reproducibility: 'NOT_REPRODUCED', regression: false, reopened_count: 0,
    },
    custom_fields: Object.fromEntries((issue?.custom_field_values || []).map(value => [value.field_id, value.value])),
    story_points: issue?.story_points?.toString() || '',
  });

  const statusesQuery = useQuery({
    queryKey: queryKeys.itemStatuses(issue?.project_id, issue?.type),
    queryFn: () => itemsApi.listStatuses({ project_id: issue?.project_id, type: issue?.type }),
    enabled: Boolean(issue?.project_id && issue?.type),
  });
  const customFieldsQuery = useQuery({
    queryKey: queryKeys.customFields(issue?.project_id || 'none', issue?.type || 'TASK'),
    queryFn: () => customFieldsApi.list(issue!.project_id, issue!.type),
    enabled: Boolean(issue?.project_id && issue?.type),
  });

  const fetchType = issue?.type === 'STORY' ? 'EPIC' : (issue?.type === 'TASK' || issue?.type === 'BUG' ? 'STORY' : null);
  const parentCandidatesQuery = useQuery({
    queryKey: queryKeys.itemsByFilter(`${issue?.project_id || 'none'}:${fetchType || 'none'}`),
    queryFn: () => itemsApi.list({ project_id: issue?.project_id, type: fetchType || undefined }),
    enabled: Boolean(isEditing && issue?.project_id && fetchType),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!issue) throw new Error('Issue not selected');
      const {
        severity,
        environment,
        origin,
        reproducibility,
        reproduction_steps,
        expected_result,
        actual_result,
        technical_analysis,
        root_cause,
        resolution,
        regression,
        reopened_count,
      } = formData.bug_details;
      const editableBugDetails = {
        severity,
        environment,
        origin,
        reproducibility,
        reproduction_steps,
        expected_result,
        actual_result,
        technical_analysis,
        root_cause,
        resolution,
        regression,
        reopened_count,
      };
      return itemsApi.update(issue.id, {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        workflow_status_id: formData.workflow_status_id,
        parent_id: formData.parent_id || null,
        transition_comment: formData.transition_comment || undefined,
        ...(issue.type === 'BUG' ? { bug_details: editableBugDetails } : {}),
        custom_fields: formData.custom_fields,
        ...(issue.type === 'STORY' ? { story_points: formData.story_points ? Number(formData.story_points) : null } : {}),
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
      if (issue) queryClient.invalidateQueries({ queryKey: queryKeys.itemHistory(issue.id) });
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

            {issue.type === 'STORY' && <div className={styles.descriptionSection}><h3>Story points</h3>{isEditing ? <select className="input-glass" value={formData.story_points} onChange={e => setFormData(current => ({ ...current, story_points: e.target.value }))}><option value="">Sem pontos</option>{[1, 2, 3, 5, 8, 13, 20].map(value => <option key={value} value={value}>{value}</option>)}</select> : <span>{formData.story_points || 'Sem pontos'}</span>}</div>}

            {issue.type === 'BUG' && (
              <div className={styles.descriptionSection}>
                <h3>Dados do bug</h3>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <label>Severidade *<select className="input-glass" required value={formData.bug_details.severity} onChange={(e) => setFormData((current) => ({ ...current, bug_details: { ...current.bug_details, severity: e.target.value as BugSeverity } }))}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option><option value="BLOCKER">Bloqueadora</option></select></label>
                      <label>Ambiente *<select className="input-glass" required value={formData.bug_details.environment} onChange={(e) => setFormData((current) => ({ ...current, bug_details: { ...current.bug_details, environment: e.target.value as BugEnvironment } }))}><option value="DEVELOPMENT">Desenvolvimento</option><option value="TEST">Teste</option><option value="HOMOLOGATION">Homologação</option><option value="PRODUCTION">Produção</option></select></label>
                      <label>Origem *<select className="input-glass" required value={formData.bug_details.origin} onChange={(e) => setFormData((current) => ({ ...current, bug_details: { ...current.bug_details, origin: e.target.value as BugOrigin } }))}><option value="DEVELOPMENT">Desenvolvimento</option><option value="TEST">Teste</option><option value="HOMOLOGATION">Homologação</option><option value="PRODUCTION">Produção</option><option value="CUSTOMER">Cliente</option><option value="AUDIT">Auditoria</option><option value="MONITORING">Monitoramento</option></select></label>
                      <label>Reprodutibilidade *<select className="input-glass" required value={formData.bug_details.reproducibility} onChange={(e) => setFormData((current) => ({ ...current, bug_details: { ...current.bug_details, reproducibility: e.target.value as BugReproducibility } }))}><option value="ALWAYS">Sempre</option><option value="INTERMITTENT">Intermitente</option><option value="ONCE">Uma vez</option><option value="NOT_REPRODUCED">Não reproduzido</option></select></label>
                    </div>
                    {(['reproduction_steps', 'expected_result', 'actual_result', 'technical_analysis', 'root_cause', 'resolution'] as const).map((field) => <textarea key={field} className="input-glass" rows={2} placeholder={field.replaceAll('_', ' ')} value={formData.bug_details[field] || ''} onChange={(e) => setFormData((current) => ({ ...current, bug_details: { ...current.bug_details, [field]: e.target.value } }))} />)}
                    <label><input type="checkbox" checked={formData.bug_details.regression || false} onChange={(e) => setFormData((current) => ({ ...current, bug_details: { ...current.bug_details, regression: e.target.checked } }))} /> Regressão</label>
                    <label>Quantidade de reaberturas<input className="input-glass" type="number" min="0" value={formData.bug_details.reopened_count || 0} onChange={(e) => setFormData((current) => ({ ...current, bug_details: { ...current.bug_details, reopened_count: Number(e.target.value) } }))} /></label>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <span>Severidade: <strong>{formData.bug_details.severity}</strong></span><span>Ambiente: <strong>{formData.bug_details.environment}</strong></span>
                    <span>Origem: <strong>{formData.bug_details.origin}</strong></span><span>Reprodutibilidade: <strong>{formData.bug_details.reproducibility}</strong></span>
                    <span>Regressão: <strong>{formData.bug_details.regression ? 'Sim' : 'Não'}</strong></span><span>Reaberturas: <strong>{formData.bug_details.reopened_count || 0}</strong></span>
                    {formData.bug_details.reproduction_steps && <span style={{ gridColumn: '1 / -1' }}>Reprodução: {formData.bug_details.reproduction_steps}</span>}
                  </div>
                )}
              </div>
            )}

            <div className={styles.descriptionSection}>
              <CustomFieldInputs
                fields={isEditing ? (customFieldsQuery.data || []) : (issue.custom_field_values || []).map(value => value.field)}
                values={formData.custom_fields}
                readOnly={!isEditing}
                onChange={(fieldId, value) => setFormData(current => ({ ...current, custom_fields: { ...current.custom_fields, [fieldId]: value } }))}
              />
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

            {!isEditing && <ItemComments itemId={issue.id} />}
            {!isEditing && <ItemAttachments itemId={issue.id} />}
            {!isEditing && <ItemCodeLinks itemId={issue.id} projectId={issue.project_id} />}
            {!isEditing && issue.type === 'BUG' && <BugRetests itemId={issue.id} statuses={statusesQuery.data || []} onChanged={onUpdate} />}
            {!isEditing && <ItemHistory itemId={issue.id} />}
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
                {formData.workflow_status_id !== issue.workflow_status_id && (
                  <div className={styles.sidebarField}>
                    <label>Comentário da transição</label>
                    <textarea className="input-glass" rows={3} placeholder="Preencha quando exigido pelo workflow" value={formData.transition_comment} onChange={e => setFormData(prev => ({ ...prev, transition_comment: e.target.value }))} />
                  </div>
                )}
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

