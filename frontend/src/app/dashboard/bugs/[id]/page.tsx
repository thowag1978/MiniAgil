'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from '../bugs.module.css';
import { bugsApi } from '@/lib/api/bugs';
import { usersApi } from '@/lib/api/users';
import { queryKeys } from '@/lib/query/keys';
import type { BugStatus, Priority } from '@/lib/types';

const statusLabels: Record<BugStatus, string> = {
  OPEN: 'Aberto',
  TRIAGE: 'Em triagem',
  CONFIRMED: 'Confirmado',
  IN_FIX: 'Em correcao',
  WAITING_VALIDATION: 'Aguardando validacao',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  REOPENED: 'Reaberto',
  REJECTED: 'Rejeitado',
  DUPLICATED: 'Duplicado',
  CANCELED: 'Cancelado',
};

const statusRequiresComment = new Set<BugStatus>(['CLOSED', 'REOPENED', 'REJECTED', 'DUPLICATED', 'CANCELED']);

const levelLabels: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

export default function BugDetailPage() {
  const params = useParams<{ id: string }>();
  const bugId = params.id;
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [attachment, setAttachment] = useState({ fileName: '', s3_url: '' });
  const [error, setError] = useState<string | null>(null);

  const bugQuery = useQuery({
    queryKey: queryKeys.bug(bugId),
    queryFn: () => bugsApi.getById(bugId),
  });

  const usersQuery = useQuery({
    queryKey: queryKeys.users,
    queryFn: () => usersApi.list(),
  });

  const refreshBug = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bug(bugId) });
  };

  const commentMutation = useMutation({
    mutationFn: () => bugsApi.addComment(bugId, comment.trim()),
    onSuccess: () => {
      setComment('');
      setError(null);
      refreshBug();
    },
    onError: (err: Error) => setError(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: BugStatus) => bugsApi.updateStatus(bugId, status, statusComment.trim() || undefined),
    onSuccess: () => {
      setStatusComment('');
      refreshBug();
    },
    onError: (err: Error) => setError(err.message),
  });

  const assigneeMutation = useMutation({
    mutationFn: (assigneeId: string) => bugsApi.updateAssignee(bugId, assigneeId || null),
    onSuccess: refreshBug,
    onError: (err: Error) => setError(err.message),
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: Priority) => bugsApi.updatePriority(bugId, priority),
    onSuccess: refreshBug,
    onError: (err: Error) => setError(err.message),
  });

  const attachmentMutation = useMutation({
    mutationFn: () => bugsApi.addAttachment(bugId, {
      fileName: attachment.fileName.trim(),
      s3_url: attachment.s3_url.trim(),
    }),
    onSuccess: () => {
      setAttachment({ fileName: '', s3_url: '' });
      setError(null);
      refreshBug();
    },
    onError: (err: Error) => setError(err.message),
  });

  const bug = bugQuery.data;

  const submitComment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) {
      setError('Informe o comentario.');
      return;
    }
    commentMutation.mutate();
  };

  const submitAttachment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!attachment.fileName.trim() || !attachment.s3_url.trim()) {
      setError('Informe nome e URL do anexo.');
      return;
    }
    attachmentMutation.mutate();
  };

  if (bugQuery.isLoading) {
    return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Carregando bug...</div>;
  }

  if (bugQuery.isError || !bug) {
    return <div style={{ padding: 24, color: '#ff8a8a' }}>Bug nao encontrado.</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className={styles.header}>
        <Link href="/dashboard/bugs/list" className={styles.muted} style={{ textDecoration: 'none' }}>Lista de Bugs</Link>
        <h1>{bug.protocol}</h1>
        <p>{bug.title}</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.detailLayout}>
        <div>
          <section className={styles.panel}>
            <h2>Dados principais</h2>
            <div className={styles.metaGrid}>
              <div><div className={styles.metaLabel}>Sistema</div><div className={styles.metaValue}>{bug.system?.name || '-'}</div></div>
              <div><div className={styles.metaLabel}>Funcionalidade</div><div className={styles.metaValue}>{bug.feature?.name || '-'}</div></div>
              <div><div className={styles.metaLabel}>Status</div><div className={styles.metaValue}>{statusLabels[bug.status]}</div></div>
              <div><div className={styles.metaLabel}>Severidade</div><div className={styles.metaValue}>{levelLabels[bug.severity]}</div></div>
              <div><div className={styles.metaLabel}>Prioridade</div><div className={styles.metaValue}>{levelLabels[bug.priority]}</div></div>
              <div><div className={styles.metaLabel}>Responsavel</div><div className={styles.metaValue}>{bug.assignee?.name || '-'}</div></div>
              <div><div className={styles.metaLabel}>Solicitante</div><div className={styles.metaValue}>{bug.reporter?.name || '-'}</div></div>
              <div><div className={styles.metaLabel}>Criado em</div><div className={styles.metaValue}>{formatDate(bug.createdAt)}</div></div>
              <div><div className={styles.metaLabel}>Resolvido em</div><div className={styles.metaValue}>{formatDate(bug.resolvedAt || undefined)}</div></div>
              <div><div className={styles.metaLabel}>Fechado em</div><div className={styles.metaValue}>{formatDate(bug.closedAt || undefined)}</div></div>
              <div><div className={styles.metaLabel}>Ambiente</div><div className={styles.metaValue}>{bug.environment || '-'}</div></div>
              <div><div className={styles.metaLabel}>Navegador/dispositivo</div><div className={styles.metaValue}>{bug.browserDevice || '-'}</div></div>
            </div>
          </section>

          <section className={styles.panel}>
            <h2>Descricao</h2>
            <p className={styles.textBlock}>{bug.description || '-'}</p>
          </section>

          <section className={styles.panel}>
            <h2>Passos para reproduzir</h2>
            <p className={styles.textBlock}>{bug.stepsToReproduce || '-'}</p>
          </section>

          <section className={styles.panel}>
            <h2>Resultado esperado</h2>
            <p className={styles.textBlock}>{bug.expectedResult || '-'}</p>
          </section>

          <section className={styles.panel}>
            <h2>Resultado obtido</h2>
            <p className={styles.textBlock}>{bug.actualResult || '-'}</p>
          </section>

          <section className={styles.panel}>
            <h2>Comentarios</h2>
            <form className={styles.inlineForm} onSubmit={submitComment}>
              <textarea className={`input-glass ${styles.textarea}`} value={comment} onChange={(event) => setComment(event.target.value)} />
              <div className={styles.actions}>
                <button className="btn-primary" type="submit" disabled={commentMutation.isPending}>Comentar</button>
              </div>
            </form>
            <div className={styles.stack} style={{ marginTop: 16 }}>
              {(bug.comments || []).length === 0 ? (
                <div className={styles.muted}>Nenhum comentario.</div>
              ) : (bug.comments || []).map((item) => (
                <div key={item.id} className={styles.panel} style={{ marginBottom: 0 }}>
                  <div className={styles.metaLabel}>{item.user?.name || 'Usuario'} - {formatDate(item.createdAt)}</div>
                  <div className={styles.textBlock}>{item.text}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside>
          <section className={styles.panel}>
            <h2>Acoes</h2>
            <div className={styles.stack}>
              <div className={styles.field}>
                <label>Status</label>
                <select
                  className="input-glass"
                  value={bug.status}
                  onChange={(event) => {
                    const nextStatus = event.target.value as BugStatus;
                    if (statusRequiresComment.has(nextStatus) && !statusComment.trim()) {
                      setError('Informe um comentario para esta alteracao de status.');
                      return;
                    }
                    statusMutation.mutate(nextStatus);
                  }}
                >
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Comentario da alteracao</label>
                <textarea className={`input-glass ${styles.textarea}`} value={statusComment} onChange={(event) => setStatusComment(event.target.value)} />
              </div>
              <div className={styles.field}>
                <label>Responsavel</label>
                <select className="input-glass" value={bug.assignee_id || ''} onChange={(event) => assigneeMutation.mutate(event.target.value)}>
                  <option value="">Sem responsavel</option>
                  {(usersQuery.data || []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Prioridade</label>
                <select className="input-glass" value={bug.priority} onChange={(event) => priorityMutation.mutate(event.target.value as Priority)}>
                  {Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <h2>Anexos</h2>
            <form className={styles.inlineForm} onSubmit={submitAttachment}>
              <input className="input-glass" value={attachment.fileName} onChange={(event) => setAttachment((current) => ({ ...current, fileName: event.target.value }))} placeholder="Nome do arquivo" />
              <input className="input-glass" value={attachment.s3_url} onChange={(event) => setAttachment((current) => ({ ...current, s3_url: event.target.value }))} placeholder="URL do anexo" />
              <button className={styles.secondaryButton} type="submit" disabled={attachmentMutation.isPending}>Anexar arquivo</button>
            </form>
            <div className={styles.stack} style={{ marginTop: 16 }}>
              {(bug.attachments || []).length === 0 ? (
                <div className={styles.muted}>Nenhum anexo.</div>
              ) : (bug.attachments || []).map((item) => (
                <a key={item.id} className={styles.protocol} href={item.s3_url} target="_blank" rel="noreferrer">{item.fileName}</a>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <h2>Historico de status</h2>
            <div className={styles.stack}>
              {(bug.statusHistory || []).length === 0 ? (
                <div className={styles.muted}>Nenhuma alteracao registrada.</div>
              ) : (bug.statusHistory || []).map((item) => (
                <div key={item.id} className={styles.timelineItem}>
                  <div className={styles.metaValue}>{item.from_status ? statusLabels[item.from_status] : '-'} para {statusLabels[item.to_status]}</div>
                  <div className={styles.muted}>{item.user?.name || 'Usuario'} - {formatDate(item.createdAt)}</div>
                  {item.comment && <div className={styles.textBlock}>{item.comment}</div>}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
