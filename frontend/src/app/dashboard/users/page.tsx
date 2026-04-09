'use client';
import React, { useState, useEffect } from 'react';
import styles from './users.module.css';
import AddUserModal from '../../../components/AddUserModal';

export default function UsersPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:4000/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error || 'Acesso negado'}`);
        fetchUsers(); // Revert back
      }
    } catch (e) {
      console.error(e);
      alert('Erro de rede');
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja deletar permanentemente o usuário ${userName}?`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Usuário deletado com sucesso.');
        fetchUsers();
      } else {
        const err = await res.json();
        alert(`Erro ao deletar: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao processar exclusão.');
    }
  };

  const handleChangePassword = async (userId: string, userName: string) => {
    const newPassword = prompt(`Digite a nova senha para o usuário ${userName} (mínimo 6 caracteres):`);
    if (!newPassword) return; // User cancelled
    if (newPassword.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/users/${userId}/password`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ newPassword })
      });
      if (res.ok) {
        alert('Senha alterada com sucesso!');
      } else {
        const err = await res.json();
        alert(`Erro ao alterar senha: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao processar modificação de senha.');
    }
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

        {loading ? (
          <div style={{ padding: 24, color: 'var(--text-dim)' }}>Carregando dados dos usuários...</div>
        ) : (
          users.map(user => (
            <div key={user.id} className={styles.tableRow}>
              <div className={styles.nameCell}>
                <div className={styles.avatar}>{user.name[0].toUpperCase()}</div>
                <span>{user.name}</span>
              </div>
              <div className={styles.emailCell}>
                {user.email}
              </div>
              <div className={styles.dateCell}>
                {new Date(user.createdAt).toLocaleDateString('pt-BR')}
              </div>
              <div>
                <select 
                  className={`${styles.roleSelect} ${user.role === 'ADMIN' ? styles.admin : styles.user}`}
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                >
                  <option value="USER">Padrão (USER)</option>
                  <option value="ADMIN">Administrador (ADMIN)</option>
                </select>
              </div>
              <div className={styles.actionsCell}>
                <button 
                  className={styles.iconBtn} 
                  title="Alterar Senha"
                  onClick={() => handleChangePassword(user.id, user.name)}
                >
                  🔑
                </button>
                <button 
                  className={styles.iconBtn} 
                  title="Deletar Usuário"
                  onClick={() => handleDelete(user.id, user.name)}
                >
                  🗑️
                </button>
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
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}
