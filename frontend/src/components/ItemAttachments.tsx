'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import { attachmentsApi } from '@/lib/api/attachments';
import { queryKeys } from '@/lib/query/keys';
import type { ItemAttachmentList } from '@/lib/types';
import styles from './modal.module.css';

function formatSize(bytes?: number | null) {
  if (bytes === null || bytes === undefined) return 'Tamanho indisponível';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function readableError(error: Error) {
  if (error instanceof ApiError && error.status === 413) return 'O arquivo excede o tamanho máximo permitido.';
  if (error instanceof ApiError && error.status === 415) return 'O formato do arquivo não é permitido ou não corresponde ao conteúdo.';
  return error.message || 'Não foi possível concluir a operação.';
}

export default function ItemAttachments({ itemId }: { itemId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState('');
  const attachmentsKey = queryKeys.itemAttachments(itemId);
  const historyKey = queryKeys.itemHistory(itemId);

  const attachmentsQuery = useQuery({
    queryKey: attachmentsKey,
    queryFn: () => attachmentsApi.list(itemId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(itemId, file),
    onSuccess: (attachment) => {
      queryClient.setQueryData<ItemAttachmentList>(attachmentsKey, (current) => current ? {
        ...current,
        data: [...current.data, attachment],
      } : current);
      queryClient.invalidateQueries({ queryKey: attachmentsKey });
      queryClient.invalidateQueries({ queryKey: historyKey });
      if (inputRef.current) inputRef.current.value = '';
      setFeedback('');
    },
    onError: (error: Error) => setFeedback(readableError(error)),
  });

  const downloadMutation = useMutation({
    mutationFn: attachmentsApi.downloadUrl,
    onSuccess: ({ url }) => {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
      queryClient.invalidateQueries({ queryKey: historyKey });
      setFeedback('');
    },
    onError: (error: Error) => setFeedback(`Não foi possível baixar o arquivo: ${readableError(error)}`),
  });

  const deleteMutation = useMutation({
    mutationFn: attachmentsApi.remove,
    onSuccess: (_, attachmentId) => {
      queryClient.setQueryData<ItemAttachmentList>(attachmentsKey, (current) => current ? {
        ...current,
        data: current.data.filter((attachment) => attachment.id !== attachmentId),
      } : current);
      queryClient.invalidateQueries({ queryKey: attachmentsKey });
      queryClient.invalidateQueries({ queryKey: historyKey });
      setFeedback('');
    },
    onError: (error: Error) => setFeedback(`Não foi possível excluir o arquivo: ${readableError(error)}`),
  });

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFeedback('');
    uploadMutation.mutate(file);
  };

  const handleDelete = (attachmentId: string) => {
    if (confirm('Excluir este anexo?')) deleteMutation.mutate(attachmentId);
  };

  const attachments = attachmentsQuery.data?.data ?? [];
  const canUpload = attachmentsQuery.data?.permissions.canUpload ?? false;

  return (
    <section className={styles.attachmentsSection}>
      <div className={styles.attachmentsHeader}>
        <h3>Anexos</h3>
        {!attachmentsQuery.isLoading && !attachmentsQuery.isError && <span>{attachments.length}</span>}
      </div>

      {attachmentsQuery.isLoading ? (
        <div className={styles.attachmentsState}>Carregando anexos...</div>
      ) : attachmentsQuery.isError ? (
        <div className={styles.attachmentsError}>
          <span>Não foi possível carregar os anexos.</span>
          <button type="button" onClick={() => attachmentsQuery.refetch()}>Tentar novamente</button>
        </div>
      ) : attachments.length === 0 ? (
        <div className={styles.attachmentsState}>Nenhum anexo ainda.</div>
      ) : (
        <div className={styles.attachmentList}>
          {attachments.map((attachment) => (
            <article className={styles.attachmentCard} key={attachment.id}>
              <div className={styles.attachmentInfo}>
                <strong title={attachment.fileName}>{attachment.fileName}</strong>
                <span>
                  {formatSize(attachment.sizeBytes)} · {attachment.mimeType || 'Tipo indisponível'}
                </span>
                <span>
                  Enviado por {attachment.user?.name || 'Usuário desconhecido'} em {formatDate(attachment.createdAt)}
                </span>
              </div>
              <div className={styles.attachmentActions}>
                <button
                  type="button"
                  onClick={() => downloadMutation.mutate(attachment.id)}
                  disabled={downloadMutation.isPending}
                >
                  Baixar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(attachment.id)}
                  disabled={!attachment.canDelete || deleteMutation.isPending}
                  title={!attachment.canDelete ? 'Você não tem permissão para excluir este anexo' : undefined}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {feedback && <div className={styles.attachmentsError}>{feedback}</div>}

      <div className={styles.attachmentUpload}>
        <input
          ref={inputRef}
          type="file"
          onChange={handleFile}
          disabled={!canUpload || uploadMutation.isPending}
          accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
        />
        <span>
          {uploadMutation.isPending
            ? 'Enviando arquivo...'
            : canUpload
              ? 'PDF, PNG, JPG ou TXT.'
              : 'Você não tem permissão para enviar anexos.'}
        </span>
      </div>
    </section>
  );
}
