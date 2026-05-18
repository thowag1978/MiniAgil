'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from '../bugs.module.css';
import { bugSystemsApi } from '@/lib/api/bugs';
import { queryKeys } from '@/lib/query/keys';
import type { BugSystem } from '@/lib/types';

type FormState = {
  name: string;
  description: string;
};

const initialForm: FormState = { name: '', description: '' };

export default function MonitoredSystemsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingSystem, setEditingSystem] = useState<BugSystem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const systemsQuery = useQuery({
    queryKey: queryKeys.bugSystems,
    queryFn: () => bugSystemsApi.list(),
  });

  const invalidateSystems = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bugSystems });
    queryClient.invalidateQueries({ queryKey: queryKeys.activeBugSystems });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = {
        name: form.name.trim(),
        description: form.description.trim() || null,
      };
      return editingSystem ? bugSystemsApi.update(editingSystem.id, input) : bugSystemsApi.create(input);
    },
    onSuccess: () => {
      setForm(initialForm);
      setEditingSystem(null);
      setError(null);
      invalidateSystems();
    },
    onError: (err: Error) => setError(err.message),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => bugSystemsApi.setActive(id, active),
    onSuccess: invalidateSystems,
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bugSystemsApi.remove(id),
    onSuccess: invalidateSystems,
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Informe o nome do sistema.');
      return;
    }
    saveMutation.mutate();
  };

  const startEdit = (system: BugSystem) => {
    setEditingSystem(system);
    setForm({ name: system.name, description: system.description || '' });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingSystem(null);
    setForm(initialForm);
    setError(null);
  };

  const handleDelete = (system: BugSystem) => {
    if (!confirm(`Excluir o sistema ${system.name}?`)) return;
    deleteMutation.mutate(system.id);
  };

  return (
    <div className="animate-fade-in">
      <div className={styles.toolbar}>
        <div className={styles.header}>
          <h1>Sistemas Monitorados</h1>
          <p>Cadastro dos sistemas acompanhados pelo controle de bugs.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="system-name">Nome</label>
          <input
            id="system-name"
            className="input-glass"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ex.: MiniAgil Web"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="system-description">Descrição</label>
          <input
            id="system-description"
            className="input-glass"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Contexto do sistema monitorado"
          />
        </div>
        <div className={styles.actions}>
          {editingSystem && (
            <button className={styles.secondaryButton} type="button" onClick={cancelEdit}>
              Cancelar
            </button>
          )}
          <button className="btn-primary" type="submit" disabled={saveMutation.isPending}>
            {editingSystem ? 'Salvar' : '+ Criar'}
          </button>
        </div>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <div>NOME</div>
          <div>DESCRICAO</div>
          <div>STATUS</div>
          <div style={{ textAlign: 'right' }}>ACOES</div>
        </div>

        {systemsQuery.isLoading ? (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Carregando sistemas...</div>
        ) : systemsQuery.isError ? (
          <div style={{ padding: 24, color: '#ff8a8a' }}>Falha ao carregar sistemas monitorados.</div>
        ) : (systemsQuery.data || []).length === 0 ? (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Nenhum sistema monitorado cadastrado.</div>
        ) : (
          (systemsQuery.data || []).map((system) => (
            <div key={system.id} className={styles.tableRow}>
              <div className={styles.name}>{system.name}</div>
              <div className={styles.muted}>{system.description || '-'}</div>
              <div>
                <span className={`${styles.badge} ${system.active ? styles.activeBadge : styles.inactiveBadge}`}>
                  {system.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className={styles.actions}>
                <button className={styles.secondaryButton} type="button" onClick={() => startEdit(system)}>
                  Editar
                </button>
                <button
                  className={styles.toggleButton}
                  type="button"
                  onClick={() => activeMutation.mutate({ id: system.id, active: !system.active })}
                >
                  {system.active ? 'Inativar' : 'Ativar'}
                </button>
                <button className={styles.dangerButton} type="button" onClick={() => handleDelete(system)}>
                  Excluir
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
