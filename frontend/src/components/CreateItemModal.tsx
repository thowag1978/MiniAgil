'use client';
import React, { useState, useEffect } from 'react';
import styles from './modal.module.css';

interface CreateItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateItemModal({ onClose, onSuccess }: CreateItemModalProps) {
  const [formData, setFormData] = useState({
    type: 'TASK',
    title: '',
    description: '',
    priority: 'MEDIUM',
    project_id: '',
    workflow_status_id: '',
    parent_id: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [potentialParents, setPotentialParents] = useState<any[]>([]);
  const [parentLoading, setParentLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch Projects
        const projRes = await fetch('http://localhost:4000/api/projects', { headers });
        let projectId = '';
        if (projRes.ok) {
          const projects = await projRes.json();
          if (projects.length > 0) projectId = projects[0].id;
        }

        // Fetch Statuses
        const statRes = await fetch('http://localhost:4000/api/items/statuses', { headers });
        let statusId = '';
        if (statRes.ok) {
          const statuses = await statRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const startStatus = statuses.find((s: any) => s.name === 'A FAZER' || s.order === 0);
          if (startStatus) statusId = startStatus.id;
        }

        setFormData(prev => ({
          ...prev,
          project_id: projectId,
          workflow_status_id: statusId
        }));
      } catch (err) {
        console.error('Error fetching initial data', err);
      } finally {
        setInitialDataLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch Potential Parents when type or project changes
  useEffect(() => {
    if (!formData.project_id) return;
    
    let fetchType = '';
    if (formData.type === 'STORY') fetchType = 'EPIC';
    else if (formData.type === 'TASK' || formData.type === 'BUG') fetchType = 'STORY';
    
    if (!fetchType) {
      setPotentialParents([]);
      setFormData(prev => ({ ...prev, parent_id: '' }));
      return;
    }

    const fetchParents = async () => {
      setParentLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:4000/api/items?project_id=${formData.project_id}&type=${fetchType}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPotentialParents(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setParentLoading(false);
      }
    };
    fetchParents();
  }, [formData.type, formData.project_id]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert('O título é obrigatório.');
      return;
    }
    if (!formData.project_id) {
      alert('Nenhum projeto associado à esta conta.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Limpa parent_id vazio se necessário
      const bodyPayload = { ...formData };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!bodyPayload.parent_id) delete (bodyPayload as any).parent_id;

      const res = await fetch(`http://localhost:4000/api/items`, {
        method: 'POST',
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
        alert(`Erro ao criar: ${errData.error || 'Desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao salvar');
    } finally {
      setLoading(false);
    }
  };

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
                    onChange={e => handleChange('type', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="EPIC">👑 Épico</option>
                    <option value="STORY">📖 História de Usuário</option>
                    <option value="TASK">✅ Tarefa</option>
                    <option value="BUG">🐛 Bug</option>
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

              {potentialParents.length > 0 && (
                 <div>
                    <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                      {formData.type === 'STORY' ? 'Épico Pai' : 'História Pai'} {parentLoading && '(Carregando...)'}
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
                <button className="btn-primary" onClick={handleSave} disabled={loading || !formData.project_id}>
                  {loading ? 'Salvando...' : 'Criar Atividade'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
