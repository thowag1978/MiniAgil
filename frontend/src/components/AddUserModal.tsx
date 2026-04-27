'use client';
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import styles from './modal.module.css';
import { usersApi } from '@/lib/api/users';
import type { UserRole } from '@/lib/types';
import { queryKeys } from '@/lib/query/keys';

interface AddUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export default function AddUserModal({ onClose, onSuccess }: AddUserModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    role: 'USER',
  });

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      onSuccess();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar: ${error.message}`);
    },
  });

  const handleChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert('Preencha os campos obrigatórios (Nome, E-mail e Senha).');
      return;
    }
    createMutation.mutate();
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
            <input className="input-glass" style={{ width: '100%', padding: '10px' }} value={formData.name} onChange={e => handleChange('name', e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>E-mail corporativo</label>
            <input className="input-glass" type="email" style={{ width: '100%', padding: '10px' }} value={formData.email} onChange={e => handleChange('email', e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Senha de Acesso</label>
            <input className="input-glass" type="password" style={{ width: '100%', padding: '10px' }} value={formData.password} onChange={e => handleChange('password', e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 5, color: 'var(--text-dim)', fontSize: '0.9rem' }}>Permissão Global</label>
            <select className="input-glass" value={formData.role} onChange={e => handleChange('role', e.target.value as UserRole)} style={{ width: '100%', padding: '10px' }}>
              <option value="USER">Usuário Padrão</option>
              <option value="ADMIN">Administrador (Total)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Salvando...' : 'Adicionar Conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


