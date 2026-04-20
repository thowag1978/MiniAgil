'use client';
import React, { useState, useEffect } from 'react';
import styles from './modal.module.css';

interface WorkflowStatus {
  id: string;
  name: string;
}

interface ParentOption {
  id: string;
  project_key: string;
  title: string;
}

interface IssueChild {
  id: string;
  title: string;
  type: string;
  project_key: string;
  workflow_status?: {
    name?: string;
  } | null;
}

interface IssueData {
  id: string;
  type: 'EPIC' | 'STORY' | 'TASK' | 'SUBTASK' | 'BUG';
  title: string;
  project_key: string;
  project_id?: string;
  description?: string | null;
  priority?: string;
  workflow_status_id?: string;
  workflow_status?: { name?: string } | null;
  parent_id?: string | null;
  parent?: { project_key: string; title: string } | null;
  assignee?: { name: string } | null;
  reporter?: { name: string } | null;
  children?: IssueChild[];
}

interface FormData {
  title: string;
  description: string;
  priority: string;
  workflow_status_id: string;
  parent_id: string;
}

interface IssueModalProps {
  issue: IssueData | null;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function IssueModal({ issue, onClose, onUpdate }: IssueModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: issue?.title || '',
    description: issue?.description || '',
    priority: issue?.priority || 'MEDIUM',
    workflow_status_id: issue?.workflow_status_id || '',
    parent_id: issue?.parent_id || '',
  });
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [potentialParents, setPotentialParents] = useState<ParentOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:4000/api/items/statuses', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: WorkflowStatus[] = await res.json();
          setStatuses(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStatuses();
  }, []);

  useEffect(() => {
    if (!isEditing || !issue || !issue.project_id) return;

    let fetchType = '';
    if (issue.type === 'STORY') fetchType = 'EPIC';
    else if (issue.type === 'TASK' || issue.type === 'BUG') fetchType = 'STORY';

    if (!fetchType) return;

    const fetchParents = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:4000/api/items?project_id=${issue.project_id}&type=${fetchType}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: ParentOption[] = await res.json();
          setPotentialParents(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchParents();
  }, [isEditing, issue]);

  if (!issue) return null;

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const payload = {
        ...formData,
        parent_id: formData.parent_id === '' ? null : formData.parent_id,
      };

      const res = await fetch(`http://localhost:4000/api/items/${issue.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsEditing(false);
        if (onUpdate) onUpdate();
      } else {
        alert('Erro ao salvar as alteracoes');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const statusName = statuses.find(s => s.id === (isEditing ? formData.workflow_status_id : issue.workflow_status_id))?.name || issue.workflow_status?.name || '';

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
              <button
                className="btn-secondary"
                style={{ marginRight: 10, padding: '4px 12px', fontSize: '0.85rem' }}
                onClick={() => setIsEditing(true)}
              >
                Editar
              </button>
            ) : (
              <button
                className="btn-primary"
                style={{ marginRight: 10, padding: '4px 12px', fontSize: '0.85rem' }}
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>X</button>
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
              <input
                className="input-glass"
                style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: 20 }}
                value={formData.title}
                onChange={e => handleChange('title', e.target.value)}
              />
            ) : (
              <h1 className={styles.issueTitle}>{formData.title}</h1>
            )}

            <div className={styles.descriptionSection}>
              <h3>Descricao</h3>
              {isEditing ? (
                <textarea
                  className="input-glass"
                  rows={6}
                  value={formData.description}
                  onChange={e => handleChange('description', e.target.value)}
                />
              ) : (
                <div className={styles.descriptionText}>
                  {formData.description ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{formData.description}</span>
                  ) : (
                    <span style={{ color: 'var(--text-dim)' }}>Sem detalhes ainda. Clique em Editar para descrever.</span>
                  )}
                </div>
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
                  <select
                    className="input-glass"
                    value={formData.workflow_status_id}
                    onChange={e => handleChange('workflow_status_id', e.target.value)}
                  >
                    {statuses.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.sidebarField}>
                  <label>Prioridade</label>
                  <select
                    className="input-glass"
                    value={formData.priority}
                    onChange={e => handleChange('priority', e.target.value)}
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Critica</option>
                  </select>
                </div>
                {potentialParents.length > 0 && (
                  <div className={styles.sidebarField}>
                    <label>Pai (Epic/Story)</label>
                    <select
                      className="input-glass"
                      value={formData.parent_id}
                      onChange={e => handleChange('parent_id', e.target.value)}
                    >
                      <option value="">Nenhum (Desvincular)</option>
                      {potentialParents.map(p => (
                        <option key={p.id} value={p.id}>{p.project_key} - {p.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={styles.sidebarField}>
                  <label>Responsavel</label>
                  <div className={styles.fieldValue}>
                    {issue.assignee ? (
                      <>
                        <div className={styles.avatarMini}>{issue.assignee.name[0]}</div>
                        <span>{issue.assignee.name}</span>
                      </>
                    ) : (
                      <span>Nao atribuido</span>
                    )}
                  </div>
                </div>
                <div className={styles.sidebarField}>
                  <label>Relator</label>
                  <div className={styles.fieldValue}>
                    {issue.reporter ? (
                      <>
                        <div className={styles.avatarMini}>{issue.reporter.name[0]}</div>
                        <span>{issue.reporter.name}</span>
                      </>
                    ) : (
                      <span>Sistema</span>
                    )}
                  </div>
                </div>
                <div className={styles.sidebarField}>
                  <label>Prioridade</label>
                  <div className={styles.fieldValue}>
                    {formData.priority === 'CRITICAL' ? 'Critica' :
                      formData.priority === 'HIGH' ? 'Alta' :
                        formData.priority === 'MEDIUM' ? 'Media' : 'Baixa'}
                  </div>
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
