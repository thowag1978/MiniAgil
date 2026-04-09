'use client';
import React, { useState } from 'react';
import styles from './modal.module.css';

interface AddUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddUserModal({ onClose, onSuccess }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER'
  });
  
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert('Preencha os campos obrigatórios (Nome, E-mail e Senha).');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onSuccess();
      } else {
        const errData = await res.json();
        alert(`Erro ao criar: ${errData.error || 'Desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao salvar rede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 500, minHeight: 'auto' }} onClick={e => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Cadastrar Novo Usuário</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </header>

        <div className={styles.modalBody} style={{ flexDirection: 'column', gap: 15, padding: '24px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nome Completo</label>
            <input 
              className="input-glass"
              style={{ width: '100%', padding: '10px' }}
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>E-mail corporativo</label>
            <input 
              className="input-glass"
              type="email"
              style={{ width: '100%', padding: '10px' }}
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Senha de Acesso</label>
            <input 
              className="input-glass"
              type="password"
              style={{ width: '100%', padding: '10px' }}
              value={formData.password}
              onChange={e => handleChange('password', e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Permissão Global</label>
            <select 
              className="input-glass" 
              value={formData.role}
              onChange={e => handleChange('role', e.target.value)}
              style={{ width: '100%', padding: '10px' }}
            >
              <option value="USER">Usuário Padrão</option>
              <option value="ADMIN">Administrador (Total)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? 'Salvando...' : 'Adicionar Conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
