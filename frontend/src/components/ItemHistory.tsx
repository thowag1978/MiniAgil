'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { historyApi } from '@/lib/api/history';
import { formatItemHistory } from '@/lib/history/formatItemHistory';
import { queryKeys } from '@/lib/query/keys';
import styles from './modal.module.css';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ItemHistory({ itemId }: { itemId: string }) {
  const historyQuery = useInfiniteQuery({
    queryKey: queryKeys.itemHistory(itemId),
    queryFn: ({ pageParam }) => historyApi.list(itemId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined
    ),
  });

  const records = historyQuery.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <section className={styles.historySection}>
      <div className={styles.historyHeader}>
        <h3>Histórico</h3>
        {!historyQuery.isLoading && !historyQuery.isError && <span>{records.length}</span>}
      </div>

      {historyQuery.isLoading ? (
        <div className={styles.historyState}>Carregando histórico...</div>
      ) : historyQuery.isError ? (
        <div className={styles.historyError}>
          <span>Não foi possível carregar o histórico.</span>
          <button type="button" onClick={() => historyQuery.refetch()}>Tentar novamente</button>
        </div>
      ) : records.length === 0 ? (
        <div className={styles.historyState}>Nenhuma alteração registrada ainda.</div>
      ) : (
        <div className={styles.timeline}>
          {records.map((record) => (
            <article className={styles.timelineItem} key={record.id}>
              <span className={styles.timelineMarker} aria-hidden="true" />
              <div>
                <p>{formatItemHistory(record)}</p>
                <time dateTime={record.createdAt}>{formatDate(record.createdAt)}</time>
              </div>
            </article>
          ))}
        </div>
      )}

      {historyQuery.hasNextPage && (
        <button
          className={styles.loadMoreHistory}
          type="button"
          onClick={() => historyQuery.fetchNextPage()}
          disabled={historyQuery.isFetchingNextPage}
        >
          {historyQuery.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </section>
  );
}
