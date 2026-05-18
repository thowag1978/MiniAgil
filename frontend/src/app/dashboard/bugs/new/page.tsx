'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import styles from '../bugs.module.css';
import { bugFeaturesApi, bugsApi, bugSystemsApi } from '@/lib/api/bugs';
import { queryKeys } from '@/lib/query/keys';
import type { BugSeverity } from '@/lib/types';

type AttachmentDraft = {
  fileName: string;
  s3_url: string;
};

type BugFormState = {
  system_id: string;
  feature_id: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  severity: BugSeverity;
  environment: string;
  browserDevice: string;
  attachments: AttachmentDraft[];
};

const initialForm: BugFormState = {
  system_id: '',
  feature_id: '',
  title: '',
  description: '',
  stepsToReproduce: '',
  expectedResult: '',
  actualResult: '',
  severity: 'MEDIUM',
  environment: '',
  browserDevice: '',
  attachments: [],
};

export default function NewBugPage() {
  const [form, setForm] = useState<BugFormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [createdProtocol, setCreatedProtocol] = useState<string | null>(null);

  const activeSystemsQuery = useQuery({
    queryKey: queryKeys.activeBugSystems,
    queryFn: () => bugSystemsApi.list({ active: true }),
  });

  const activeFeaturesQuery = useQuery({
    queryKey: queryKeys.activeBugFeatures(form.system_id),
    queryFn: () => bugFeaturesApi.list({ system_id: form.system_id, active: true }),
    enabled: Boolean(form.system_id),
  });

  const createMutation = useMutation({
    mutationFn: () => bugsApi.create({
      system_id: form.system_id,
      feature_id: form.feature_id || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      stepsToReproduce: form.stepsToReproduce.trim() || null,
      expectedResult: form.expectedResult.trim() || null,
      actualResult: form.actualResult.trim() || null,
      severity: form.severity,
      environment: form.environment.trim() || null,
      browserDevice: form.browserDevice.trim() || null,
      attachments: form.attachments
        .map((attachment) => ({
          fileName: attachment.fileName.trim(),
          s3_url: attachment.s3_url.trim(),
        }))
        .filter((attachment) => attachment.fileName && attachment.s3_url),
    }),
    onSuccess: (bug) => {
      setCreatedProtocol(bug.protocol);
      setForm(initialForm);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateField = (field: keyof BugFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'system_id' ? { feature_id: '' } : {}),
    }));
  };

  const updateAttachment = (index: number, field: keyof AttachmentDraft, value: string) => {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.map((attachment, currentIndex) => (
        currentIndex === index ? { ...attachment, [field]: value } : attachment
      )),
    }));
  };

  const addAttachment = () => {
    setForm((current) => ({
      ...current,
      attachments: [...current.attachments, { fileName: '', s3_url: '' }],
    }));
  };

  const removeAttachment = (index: number) => {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.system_id) {
      setError('Selecione o sistema.');
      return;
    }
    if (!form.title.trim()) {
      setError('Informe o titulo do bug.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="animate-fade-in">
      <div className={styles.header}>
        <h1>Novo Bug</h1>
        <p>Registro de novas ocorrencias para investigacao.</p>
      </div>

      {createdProtocol && (
        <div className={styles.success}>Bug aberto com protocolo {createdProtocol}. Status inicial: Aberto.</div>
      )}
      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.bugForm} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="bug-system">Sistema</label>
          <select
            id="bug-system"
            className="input-glass"
            value={form.system_id}
            disabled={activeSystemsQuery.isLoading}
            onChange={(event) => updateField('system_id', event.target.value)}
          >
            <option value="">Selecione um sistema ativo</option>
            {(activeSystemsQuery.data || []).map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="bug-feature">Funcionalidade</label>
          <select
            id="bug-feature"
            className="input-glass"
            value={form.feature_id}
            disabled={!form.system_id || activeFeaturesQuery.isLoading}
            onChange={(event) => updateField('feature_id', event.target.value)}
          >
            <option value="">Selecione uma funcionalidade ativa</option>
            {(activeFeaturesQuery.data || []).map((feature) => (
              <option key={feature.id} value={feature.id}>
                {feature.name}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label htmlFor="bug-title">Titulo</label>
          <input
            id="bug-title"
            className="input-glass"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            placeholder="Resumo objetivo do problema"
          />
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label htmlFor="bug-description">Descricao</label>
          <textarea
            id="bug-description"
            className={`input-glass ${styles.textarea}`}
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
          />
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label htmlFor="bug-steps">Passos para reproduzir</label>
          <textarea
            id="bug-steps"
            className={`input-glass ${styles.textarea}`}
            value={form.stepsToReproduce}
            onChange={(event) => updateField('stepsToReproduce', event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="bug-expected">Resultado esperado</label>
          <textarea
            id="bug-expected"
            className={`input-glass ${styles.textarea}`}
            value={form.expectedResult}
            onChange={(event) => updateField('expectedResult', event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="bug-actual">Resultado obtido</label>
          <textarea
            id="bug-actual"
            className={`input-glass ${styles.textarea}`}
            value={form.actualResult}
            onChange={(event) => updateField('actualResult', event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="bug-severity">Severidade</label>
          <select
            id="bug-severity"
            className="input-glass"
            value={form.severity}
            onChange={(event) => updateField('severity', event.target.value)}
          >
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="CRITICAL">Critica</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="bug-environment">Ambiente</label>
          <input
            id="bug-environment"
            className="input-glass"
            value={form.environment}
            onChange={(event) => updateField('environment', event.target.value)}
            placeholder="Producao, homologacao, local"
          />
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label htmlFor="bug-device">Navegador/dispositivo</label>
          <input
            id="bug-device"
            className="input-glass"
            value={form.browserDevice}
            onChange={(event) => updateField('browserDevice', event.target.value)}
            placeholder="Chrome 125 / Windows, iPhone Safari"
          />
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label>Anexos</label>
          {form.attachments.map((attachment, index) => (
            <div key={index} className={styles.form} style={{ gridTemplateColumns: '1fr 2fr auto', marginBottom: 8, padding: 12 }}>
              <input
                className="input-glass"
                value={attachment.fileName}
                onChange={(event) => updateAttachment(index, 'fileName', event.target.value)}
                placeholder="Nome do arquivo"
              />
              <input
                className="input-glass"
                value={attachment.s3_url}
                onChange={(event) => updateAttachment(index, 's3_url', event.target.value)}
                placeholder="URL do anexo"
              />
              <button className={styles.dangerButton} type="button" onClick={() => removeAttachment(index)}>
                Remover
              </button>
            </div>
          ))}
          <button className={styles.secondaryButton} type="button" onClick={addAttachment}>
            + Adicionar anexo
          </button>
        </div>

        <div className={`${styles.actions} ${styles.fullWidth}`}>
          <button className="btn-primary" type="submit" disabled={createMutation.isPending}>
            Abrir Bug
          </button>
        </div>
      </form>
    </div>
  );
}
