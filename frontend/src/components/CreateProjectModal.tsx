'use client';
import React, { useState } from 'react';
import styles from './createProject.module.css';

interface CreatedProject {
  id: string;
  name: string;
  key_prefix: string;
  description?: string | null;
}

interface Props {
  onClose: () => void;
  onSuccess: (newProject: CreatedProject) => void;
}

export default function CreateProjectModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [keyPrefix, setKeyPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const token = localStorage.getItem('token');

      const res = await fetch('http://localhost:4000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, key_prefix: keyPrefix.toUpperCase(), description }),
      });

      if (res.ok) {
        const projectCreated: CreatedProject = await res.json();
        onSuccess(projectCreated);
      } else {
        const err = await res.json().catch(() => null);
        setErrorMsg(err?.error || 'Erro ao criar projeto.');
      }
    } catch {
      setErrorMsg('Erro de rede ao criar projeto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Novo Projeto</h2>
          <button className={styles.closeBtn} onClick={onClose}>X</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.formBody}>
          {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

          <div className={styles.formGroup}>
            <label>Nome do Projeto <span className={styles.required}>*</span></label>
            <input
              type="text"
              className="input-glass"
              placeholder="Ex: App Android Nativo"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Chave do Projeto (Prefixo) <span className={styles.required}>*</span></label>
            <input
              type="text"
              className="input-glass"
              placeholder="Ex: AND, MOB, SYS (ate 5 letras)"
              maxLength={5}
              value={keyPrefix}
              onChange={e => setKeyPrefix(e.target.value.toUpperCase())}
              required
            />
            <span className={styles.hintText}>Prefixo para tarefas (Ex: {keyPrefix || 'AND'}-1, {keyPrefix || 'AND'}-2)</span>
          </div>

          <div className={styles.formGroup}>
            <label>Descricao do Projeto</label>
            <textarea
              className="input-glass"
              rows={4}
              placeholder="Descreva o proposito deste portfolio..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
