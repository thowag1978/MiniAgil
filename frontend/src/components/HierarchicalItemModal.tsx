'use client';
import React, { useState, useEffect } from 'react';
import styles from './modal.module.css';

interface HierarchicalItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
  mode: 'CREATE' | 'EDIT';
  type: 'EPIC' | 'STORY' | 'TASK';
  parentData?: { id: string; title: string; project_key: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any;
}

export default function HierarchicalItemModal({ onClose, onSuccess, mode, type, parentData, initialData }: HierarchicalItemModalProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    priority: initialData?.priority || 'MEDIUM',
    project_id: initialData?.project_id || '',
    workflow_status_id: initialData?.workflow_status_id || '',
    assignee_id: initialData?.assignee_id || '',
    parent_id: initialData?.parent_id || parentData?.id || '',
    acceptance_criteria: initialData?.acceptance_criteria || '',
    estimate: initialData?.estimate || ''
  });
  
  const [loading, setLoading] = useState(false);
  const [initialDataLoading, setInitialDataLoading] = useState(mode === 'CREATE');
  const [users, setUsers] = useState<{id: string, name: string}[]>([]);
  const [statuses, setStatuses] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch Users for Assignment
        const usersRes = await fetch('http://localhost:4000/api/users', { headers });
        if (usersRes.ok) setUsers(await usersRes.json());

        // Fetch Statuses
        const statRes = await fetch('http://localhost:4000/api/items/statuses', { headers });
        let statusId = '';
        if (statRes.ok) {
          const statData = await statRes.json();
          setStatuses(statData);
          if (mode === 'CREATE') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const startStatus = statData.find((s: any) => s.name === 'A FAZER' || s.order === 0);
            if (startStatus) statusId = startStatus.id;
          }
        }

        if (mode === 'CREATE') {
          // Fetch Projects
          const projRes = await fetch('http://localhost:4000/api/projects', { headers });
          let projectId = '';
          if (projRes.ok) {
            const projects = await projRes.json();
            if (projects.length > 0) projectId = projects[0].id;
          }

          setFormData(prev => ({
            ...prev,
            project_id: projectId,
            workflow_status_id: statusId
          }));
        }
      } catch (err) {
        console.error('Error fetching data', err);
      } finally {
        setInitialDataLoading(false);
      }
    };
    fetchData();
  }, [mode]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert('O título é obrigatório.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const bodyPayload = { ...formData, type };
      
      // Clean up fields based on type
      if (type === 'EPIC') {
        bodyPayload.parent_id = '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (bodyPayload as any).acceptance_criteria;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (bodyPayload as any).estimate;
      } else if (type === 'STORY') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (bodyPayload as any).estimate;
      } else if (type === 'TASK') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (bodyPayload as any).acceptance_criteria;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!bodyPayload.assignee_id) (bodyPayload as any).assignee_id = null;

      const url = mode === 'CREATE' ? `http://localhost:4000/api/items` : `http://localhost:4000/api/items/${initialData.id}`;
      const method = mode === 'CREATE' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(bodyPayload)
      });
      if (res.ok) {
        onSuccess();
      } else {
        const errData = await res.json();
        alert(`Erro ao salvar: ${errData.error || 'Desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const titlePrefix = mode === 'CREATE' ? 'Criar Nova' : 'Editar';
  const typeLabels = { EPIC: '👑 Épico', STORY: '📖 História', TASK: '✅ Atividade' };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{titlePrefix} {typeLabels[type]}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </header>

        <div className={styles.modalBody} style={{ flexDirection: 'column', gap: 20 }}>
          {initialDataLoading ? (
            <div style={{ color: 'var(--text-dim)' }}>Carregando configuração...</div>
          ) : (
            <>
              {parentData && (mode === 'CREATE') && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: 8, fontSize: '0.9rem', color: 'var(--text-dim)' }}>
                  <strong>Pai vinculado:</strong> {parentData.project_key} - {parentData.title}
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Título <span style={{color: 'red'}}>*</span></label>
                <input 
                  className="input-glass"
                  placeholder="Resumo do item..."
                  value={formData.title}
                  onChange={e => handleChange('title', e.target.value)}
                  style={{ width: '100%', fontSize: '1.1rem', padding: '10px 15px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 15 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Status</label>
                  <select 
                    className="input-glass" 
                    value={formData.workflow_status_id}
                    onChange={e => handleChange('workflow_status_id', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Prioridade</label>
                  <select 
                    className="input-glass" 
                    value={formData.priority}
                    onChange={e => handleChange('priority', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="LOW">🔵 Baixa</option>
                    <option value="MEDIUM">🟡 Média</option>
                    <option value="HIGH">🔴 Alta</option>
                    <option value="CRITICAL">🔥 Crítica</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 15 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Responsável</label>
                  <select 
                    className="input-glass" 
                    value={formData.assignee_id}
                    onChange={e => handleChange('assignee_id', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Não atribuído</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                {type === 'TASK' && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Estimativa (Pts)</label>
                    <input 
                      type="number"
                      className="input-glass" 
                      value={formData.estimate}
                      onChange={e => handleChange('estimate', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Descrição</label>
                <textarea 
                  className="input-glass"
                  placeholder="Adicione detalhes..."
                  rows={4}
                  value={formData.description}
                  onChange={e => handleChange('description', e.target.value)}
                  style={{ width: '100%', padding: '10px 15px' }}
                />
              </div>

              {type === 'STORY' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Critério de Aceite</label>
                  <textarea 
                    className="input-glass"
                    placeholder="Regras para aprovação desta história..."
                    rows={3}
                    value={formData.acceptance_criteria}
                    onChange={e => handleChange('acceptance_criteria', e.target.value)}
                    style={{ width: '100%', padding: '10px 15px' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                <button className="btn-primary" onClick={handleSave} disabled={loading || (mode === 'CREATE' && !formData.project_id)}>
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
