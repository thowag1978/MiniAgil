'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './users.module.css';
import AddUserModal from '../../../components/AddUserModal';
import { usersApi } from '@/lib/api/users';
import { queryKeys } from '@/lib/query/keys';
import type { UserRole } from '@/lib/types';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const usersQuery = useQuery({
    queryKey: queryKeys.users,
    queryFn: () => usersApi.list(),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => usersApi.updateRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
    onError: (error: Error) => alert(`Erro: ${error.message || 'Acesso negado'}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => usersApi.remove(userId),
    onSuccess: () => {
      alert('Usuário deletado com sucesso.');
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
    onError: (error: Error) => alert(`Erro ao deletar: ${error.message}`),
  });

  const passwordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) => usersApi.updatePassword(userId, newPassword),
    onSuccess: () => alert('Senha alterada com sucesso!'),
    onError: (error: Error) => alert(`Erro ao alterar senha: ${error.message}`),
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    roleMutation.mutate({ userId, role: newRole as UserRole });
  };

  const handleDelete = (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja deletar permanentemente o usuário ${userName}?`)) return;
    deleteMutation.mutate(userId);
  };

  const handleChangePassword = (userId: string, userName: string) => {
    const newPassword = prompt(`Digite a nova senha para o usuário ${userName} (mínimo 6 caracteres):`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    passwordMutation.mutate({ userId, newPassword });
  };

  return (
    <div className="animate-fade-in">
      <div className={styles.dashHeader}>
        <div>
          <h1>Gestão de Usuários</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Verifique contas e controle acessos.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsAddUserModalOpen(true)}>+ Adicionar Usuário</button>
      </div>

      <div className={styles.usersTableWrapper}>
        <div className={styles.tableHeader}>
          <div>NOME</div>
          <div>EMAIL DOMÍNIO</div>
          <div>DATA DE CADASTRO</div>
          <div>ACESSO GLOBAL</div>
          <div style={{ textAlign: 'right' }}>AÇÕES</div>
        </div>

        {usersQuery.isLoading ? (
          <div style={{ padding: 24, color: 'var(--text-dim)' }}>Carregando dados dos usuários...</div>
        ) : usersQuery.isError ? (
          <div style={{ padding: 24, color: '#ff6b6b' }}>Falha ao carregar usuários.</div>
        ) : (
          (usersQuery.data || []).map(user => (
            <div key={user.id} className={styles.tableRow}>
              <div className={styles.nameCell}>
                <div className={styles.avatar}>{user.name[0].toUpperCase()}</div>
                <span>{user.name}</span>
              </div>
              <div className={styles.emailCell}>{user.email}</div>
              <div className={styles.dateCell}>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</div>
              <div>
                <select className={`${styles.roleSelect} ${user.role === 'ADMIN' ? styles.admin : styles.user}`} value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value)}>
                  <option value="USER">Padrão (USER)</option>
                  <option value="ADMIN">Administrador (ADMIN)</option>
                </select>
              </div>
              <div className={styles.actionsCell}>
                <button className={styles.iconBtn} title="Alterar Senha" onClick={() => handleChangePassword(user.id, user.name)}>??</button>
                <button className={styles.iconBtn} title="Deletar Usuário" onClick={() => handleDelete(user.id, user.name)}>???</button>
              </div>
            </div>
          ))
        )}
      </div>

      {isAddUserModalOpen && (
        <AddUserModal
          onClose={() => setIsAddUserModalOpen(false)}
          onSuccess={() => {
            setIsAddUserModalOpen(false);
            queryClient.invalidateQueries({ queryKey: queryKeys.users });
          }}
        />
      )}
    </div>
  );
}


