'use client';
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import styles from './createProject.module.css';
import { projectsApi } from '@/lib/api/projects';
import { queryKeys } from '@/lib/query/keys';
import type { Project } from '@/lib/types';

interface Props {
  onClose: () => void;
  onSuccess: (newProject: Project) => void;
}

export default function CreateProjectModal({ onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [keyPrefix, setKeyPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const mutation = useMutation({
    mutationFn: () => projectsApi.create({ name, key_prefix: keyPrefix.toUpperCase(), description }),
    onSuccess: (projectCreated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      onSuccess(projectCreated);
    },
    onError: (error: Error) => {
      setErrorMsg(error.message || 'Erro ao criar projeto.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    mutation.mutate();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Novo Projeto</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.formBody}>
          {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

          <div className={styles.formGroup}>
            <label>Nome do Projeto <span className={styles.required}>*</span></label>
            <input type="text" className="input-glass" placeholder="Ex: App Android Nativo" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className={styles.formGroup}>
            <label>Chave do Projeto (Prefixo) <span className={styles.required}>*</span></label>
            <input type="text" className="input-glass" placeholder="Ex: AND, MOB, SYS (até 5 letras)" maxLength={5} value={keyPrefix} onChange={e => setKeyPrefix(e.target.value.toUpperCase())} required />
            <span className={styles.hintText}>Prefixo para tarefas (Ex: {keyPrefix || 'AND'}-1, {keyPrefix || 'AND'}-2)</span>
          </div>

          <div className={styles.formGroup}>
            <label>Descrição do Projeto</label>
            <textarea className="input-glass" rows={4} placeholder="Descreva o propósito deste portfólio..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Criando...' : 'Criar Projeto'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

