'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bugRetestsApi } from '@/lib/api/bugRetests';
import { queryKeys } from '@/lib/query/keys';
import type { BugEnvironment, BugRetestResult, WorkflowStatus } from '@/lib/types';
import styles from './modal.module.css';

const resultLabels: Record<BugRetestResult, string> = { APPROVED: 'Aprovado', FAILED: 'Falhou', BLOCKED: 'Bloqueado', NOT_TESTED: 'Não testado' };
const environmentLabels: Record<BugEnvironment, string> = { DEVELOPMENT: 'Desenvolvimento', TEST: 'Teste', HOMOLOGATION: 'Homologação', PRODUCTION: 'Produção' };

export default function BugRetests({ itemId, statuses, onChanged }: { itemId: string; statuses: WorkflowStatus[]; onChanged?: () => void }) {
  const queryClient = useQueryClient();
  const [environment, setEnvironment] = useState<BugEnvironment>('TEST');
  const [result, setResult] = useState<BugRetestResult>('NOT_TESTED');
  const [observations, setObservations] = useState('');
  const [targetStatusId, setTargetStatusId] = useState('');
  const retestsQuery = useQuery({ queryKey: queryKeys.bugRetests(itemId), queryFn: () => bugRetestsApi.list(itemId) });
  const targets = useMemo(() => statuses.filter((status) => status.is_active !== false && (
    result === 'FAILED' ? status.category === 'IN_PROGRESS' : result === 'APPROVED' ? status.category === 'DONE' : false
  )), [result, statuses]);

  const createMutation = useMutation({
    mutationFn: () => bugRetestsApi.create(itemId, {
      environment, result, observations: observations.trim() || undefined,
      target_status_id: targetStatusId || undefined,
    }),
    onSuccess: () => {
      setObservations(''); setTargetStatusId('');
      queryClient.invalidateQueries({ queryKey: queryKeys.bugRetests(itemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.itemHistory(itemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.items });
      onChanged?.();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (result === 'FAILED' && !targetStatusId) return;
    createMutation.mutate();
  }

  return <section className={styles.retestsSection}>
    <div className={styles.historyHeader}><h3>Retestes</h3><span>{retestsQuery.data?.length || 0}</span></div>
    <form className={styles.retestForm} onSubmit={submit}>
      <div className={styles.retestGrid}>
        <label>Ambiente<select className="input-glass" value={environment} onChange={(event) => setEnvironment(event.target.value as BugEnvironment)}>{Object.entries(environmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Resultado<select className="input-glass" value={result} onChange={(event) => { setResult(event.target.value as BugRetestResult); setTargetStatusId(''); }}>{Object.entries(resultLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {(result === 'FAILED' || result === 'APPROVED') && <label>Status após reteste<select required={result === 'FAILED'} className="input-glass" value={targetStatusId} onChange={(event) => setTargetStatusId(event.target.value)}><option value="">{result === 'FAILED' ? 'Selecione o status de reabertura' : 'Manter status atual'}</option>{targets.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label>}
      </div>
      <textarea className="input-glass" rows={3} placeholder="Observações do reteste" value={observations} onChange={(event) => setObservations(event.target.value)} />
      <button type="submit" className="btn-primary" disabled={createMutation.isPending || (result === 'FAILED' && !targetStatusId)}>{createMutation.isPending ? 'Registrando...' : 'Registrar reteste'}</button>
      {createMutation.isError && <div className={styles.historyError}>Não foi possível registrar: {createMutation.error.message}</div>}
    </form>
    {retestsQuery.isLoading ? <div className={styles.historyState}>Carregando retestes...</div>
      : retestsQuery.isError ? <div className={styles.historyError}>Não foi possível carregar os retestes.</div>
      : !retestsQuery.data?.length ? <div className={styles.historyState}>Nenhum reteste registrado.</div>
      : <div className={styles.retestList}>{retestsQuery.data.map((retest) => <article key={retest.id} className={styles.retestCard}>
        <div><strong>{resultLabels[retest.result]}</strong><span>{environmentLabels[retest.environment]}</span></div>
        <p>{retest.observations || 'Sem observações.'}</p>
        <small>{retest.tester.name} · {new Date(retest.createdAt).toLocaleString('pt-BR')}</small>
      </article>)}</div>}
  </section>;
}
