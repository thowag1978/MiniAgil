'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from '../bugs.module.css';
import { bugFeaturesApi, bugSystemsApi } from '@/lib/api/bugs';
import { queryKeys } from '@/lib/query/keys';
import type { BugFeature } from '@/lib/types';

type FormState = {
  system_id: string;
  name: string;
  description: string;
};

const initialForm: FormState = { system_id: '', name: '', description: '' };

export default function BugFeaturesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingFeature, setEditingFeature] = useState<BugFeature | null>(null);
  const [error, setError] = useState<string | null>(null);

  const systemsQuery = useQuery({
    queryKey: queryKeys.bugSystems,
    queryFn: () => bugSystemsApi.list(),
  });

  const featuresQuery = useQuery({
    queryKey: queryKeys.bugFeatures,
    queryFn: () => bugFeaturesApi.list(),
  });

  const invalidateFeatures = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bugFeatures });
    if (form.system_id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeBugFeatures(form.system_id) });
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = {
        system_id: form.system_id,
        name: form.name.trim(),
        description: form.description.trim() || null,
      };
      return editingFeature ? bugFeaturesApi.update(editingFeature.id, input) : bugFeaturesApi.create(input);
    },
    onSuccess: () => {
      setForm(initialForm);
      setEditingFeature(null);
      setError(null);
      invalidateFeatures();
    },
    onError: (err: Error) => setError(err.message),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => bugFeaturesApi.setActive(id, active),
    onSuccess: invalidateFeatures,
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bugFeaturesApi.remove(id),
    onSuccess: invalidateFeatures,
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.system_id) {
      setError('Selecione o sistema.');
      return;
    }
    if (!form.name.trim()) {
      setError('Informe o nome da funcionalidade.');
      return;
    }
    saveMutation.mutate();
  };

  const startEdit = (feature: BugFeature) => {
    setEditingFeature(feature);
    setForm({
      system_id: feature.system_id,
      name: feature.name,
      description: feature.description || '',
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingFeature(null);
    setForm(initialForm);
    setError(null);
  };

  const handleDelete = (feature: BugFeature) => {
    if (!confirm(`Excluir a funcionalidade ${feature.name}?`)) return;
    deleteMutation.mutate(feature.id);
  };

  return (
    <div className="animate-fade-in">
      <div className={styles.toolbar}>
        <div className={styles.header}>
          <h1>Funcionalidades</h1>
          <p>Mapeamento de funcionalidades relacionadas aos bugs.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="feature-system">Sistema</label>
          <select
            id="feature-system"
            className="input-glass"
            value={form.system_id}
            onChange={(event) => setForm((current) => ({ ...current, system_id: event.target.value }))}
          >
            <option value="">Selecione</option>
            {(systemsQuery.data || []).map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="feature-name">Nome da funcionalidade</label>
          <input
            id="feature-name"
            className="input-glass"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ex.: Login"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="feature-description">Descricao</label>
          <input
            id="feature-description"
            className="input-glass"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Contexto da funcionalidade"
          />
        </div>
        <div className={styles.actions}>
          {editingFeature && (
            <button className={styles.secondaryButton} type="button" onClick={cancelEdit}>
              Cancelar
            </button>
          )}
          <button className="btn-primary" type="submit" disabled={saveMutation.isPending}>
            {editingFeature ? 'Salvar' : '+ Criar'}
          </button>
        </div>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <div>SISTEMA</div>
          <div>FUNCIONALIDADE</div>
          <div>STATUS</div>
          <div style={{ textAlign: 'right' }}>ACOES</div>
        </div>

        {featuresQuery.isLoading ? (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Carregando funcionalidades...</div>
        ) : featuresQuery.isError ? (
          <div style={{ padding: 24, color: '#ff8a8a' }}>Falha ao carregar funcionalidades.</div>
        ) : (featuresQuery.data || []).length === 0 ? (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Nenhuma funcionalidade cadastrada.</div>
        ) : (
          (featuresQuery.data || []).map((feature) => (
            <div key={feature.id} className={styles.tableRow}>
              <div className={styles.muted}>{feature.system?.name || '-'}</div>
              <div>
                <div className={styles.name}>{feature.name}</div>
                <div className={styles.muted}>{feature.description || '-'}</div>
              </div>
              <div>
                <span className={`${styles.badge} ${feature.active ? styles.activeBadge : styles.inactiveBadge}`}>
                  {feature.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <div className={styles.actions}>
                <button className={styles.secondaryButton} type="button" onClick={() => startEdit(feature)}>
                  Editar
                </button>
                <button
                  className={styles.toggleButton}
                  type="button"
                  onClick={() => activeMutation.mutate({ id: feature.id, active: !feature.active })}
                >
                  {feature.active ? 'Inativar' : 'Ativar'}
                </button>
                <button className={styles.dangerButton} type="button" onClick={() => handleDelete(feature)}>
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
