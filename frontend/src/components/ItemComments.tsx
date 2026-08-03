'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '@/lib/api/comments';
import { useAuth } from '@/lib/auth/AuthContext';
import { queryKeys } from '@/lib/query/keys';
import type { ItemComment } from '@/lib/types';
import styles from './modal.module.css';

function formatCommentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ItemComments({ itemId }: { itemId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [feedback, setFeedback] = useState('');
  const commentsKey = queryKeys.itemComments(itemId);
  const historyKey = queryKeys.itemHistory(itemId);

  const commentsQuery = useQuery({
    queryKey: commentsKey,
    queryFn: () => commentsApi.list(itemId),
  });

  const createMutation = useMutation({
    mutationFn: (text: string) => commentsApi.create(itemId, text),
    onSuccess: (comment) => {
      queryClient.setQueryData<ItemComment[]>(commentsKey, (current = []) => [...current, comment]);
      queryClient.invalidateQueries({ queryKey: commentsKey });
      queryClient.invalidateQueries({ queryKey: historyKey });
      setNewText('');
      setFeedback('');
    },
    onError: (error: Error) => setFeedback(`Não foi possível criar o comentário: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ commentId, text }: { commentId: string; text: string }) => commentsApi.update(commentId, text),
    onSuccess: (updated) => {
      queryClient.setQueryData<ItemComment[]>(commentsKey, (current = []) => (
        current.map((comment) => comment.id === updated.id ? updated : comment)
      ));
      queryClient.invalidateQueries({ queryKey: commentsKey });
      queryClient.invalidateQueries({ queryKey: historyKey });
      setEditingId(null);
      setEditText('');
      setFeedback('');
    },
    onError: (error: Error) => setFeedback(`Não foi possível editar o comentário: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: commentsApi.remove,
    onSuccess: (_, commentId) => {
      queryClient.setQueryData<ItemComment[]>(commentsKey, (current = []) => (
        current.filter((comment) => comment.id !== commentId)
      ));
      queryClient.invalidateQueries({ queryKey: commentsKey });
      queryClient.invalidateQueries({ queryKey: historyKey });
      setFeedback('');
    },
    onError: (error: Error) => setFeedback(`Não foi possível excluir o comentário: ${error.message}`),
  });

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    const text = newText.trim();
    if (!text) {
      setFeedback('Digite um texto para o comentário.');
      return;
    }
    setFeedback('');
    createMutation.mutate(text);
  };

  const startEditing = (comment: ItemComment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
    setFeedback('');
  };

  const handleUpdate = (commentId: string) => {
    const text = editText.trim();
    if (!text) {
      setFeedback('O comentário não pode ficar vazio.');
      return;
    }
    setFeedback('');
    updateMutation.mutate({ commentId, text });
  };

  const handleDelete = (commentId: string) => {
    if (confirm('Excluir este comentário?')) {
      setFeedback('');
      deleteMutation.mutate(commentId);
    }
  };

  return (
    <section className={styles.commentsSection}>
      <div className={styles.commentsHeader}>
        <h3>Comentários</h3>
        {!commentsQuery.isLoading && !commentsQuery.isError && (
          <span>{commentsQuery.data?.length || 0}</span>
        )}
      </div>

      {commentsQuery.isLoading ? (
        <div className={styles.commentsState}>Carregando comentários...</div>
      ) : commentsQuery.isError ? (
        <div className={styles.commentsError}>Não foi possível carregar os comentários.</div>
      ) : (commentsQuery.data || []).length === 0 ? (
        <div className={styles.commentsState}>Nenhum comentário ainda.</div>
      ) : (
        <div className={styles.commentList}>
          {(commentsQuery.data || []).map((comment) => {
            const isOwnComment = comment.user.id === user?.id;
            const isEditingComment = editingId === comment.id;

            return (
              <article className={styles.commentCard} key={comment.id}>
                <div className={styles.commentMeta}>
                  <strong>{comment.user.name}</strong>
                  <span>{formatCommentDate(comment.createdAt)}</span>
                  {comment.isEdited && <span>Editado</span>}
                  {isOwnComment && (
                    <div className={styles.commentActions}>
                      <button type="button" onClick={() => startEditing(comment)}>Editar</button>
                      <button type="button" onClick={() => handleDelete(comment.id)} disabled={deleteMutation.isPending}>Excluir</button>
                    </div>
                  )}
                </div>

                {isEditingComment ? (
                  <div className={styles.commentEditForm}>
                    <textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={3} />
                    <div>
                      <button type="button" onClick={() => { setEditingId(null); setEditText(''); }}>Cancelar</button>
                      <button type="button" onClick={() => handleUpdate(comment.id)} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={styles.commentText}>{comment.text}</p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {feedback && <div className={styles.commentsError}>{feedback}</div>}

      <form className={styles.commentForm} onSubmit={handleCreate}>
        <textarea
          value={newText}
          onChange={(event) => setNewText(event.target.value)}
          placeholder="Escreva um comentário..."
          rows={3}
        />
        <button className="btn-primary" disabled={createMutation.isPending || !newText.trim()}>
          {createMutation.isPending ? 'Enviando...' : 'Comentar'}
        </button>
      </form>
    </section>
  );
}
