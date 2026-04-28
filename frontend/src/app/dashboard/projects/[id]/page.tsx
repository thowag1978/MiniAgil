'use client';
import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import styles from './detail.module.css';
import { projectsApi } from '@/lib/api/projects';
import { itemsApi } from '@/lib/api/items';
import { queryKeys } from '@/lib/query/keys';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId || 'none'),
    queryFn: () => projectsApi.getById(projectId),
    enabled: Boolean(projectId),
  });

  const epicsQuery = useQuery({
    queryKey: queryKeys.hierarchicalItems(projectId || 'none'),
    queryFn: () => itemsApi.listHierarchical(projectId),
    enabled: Boolean(projectId),
  });

  const normalizedEpics = useMemo(() => {
    const epics = epicsQuery.data || [];
    return epics.map(epic => {
      const status = epic.workflow_status?.name || 'A FAZER';
      const statusCls = status === 'CONCLUIDO' || status === 'CONCLUÍDO' ? 'done' : status === 'EM PROGRESSO' ? 'prog' : 'todo';
      return { ...epic, status, statusCls, linkedCount: epic.children?.length || 0 };
    });
  }, [epicsQuery.data]);

  if (projectQuery.isLoading || epicsQuery.isLoading) return <div>Carregando visão de projeto...</div>;
  if (projectQuery.isError || epicsQuery.isError) return <div>Não foi possível carregar os dados do projeto.</div>;
  if (!projectQuery.data) return <div>Projeto não encontrado.</div>;

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/dashboard/projects">Projetos</Link> &gt; <span>{projectQuery.data.key_prefix}</span>
        </div>
        <div className={styles.titleRow}>
          <h1>{projectQuery.data.name}</h1>
          <span className={styles.keyBadge}>{projectQuery.data.key_prefix}</span>
        </div>
        <div className={styles.desc}>{projectQuery.data.description || 'Sem descrição cadastrada.'}</div>
      </div>

      <div className={styles.epicsSection}>
        <div className={styles.sectionHeader}>
          <h2>Épicos Deste Projeto</h2>
        </div>

        <div className={styles.epicList}>
          {normalizedEpics.length === 0 ? (
            <div>Nenhum épico encontrado para este projeto.</div>
          ) : (
            normalizedEpics.map(epic => (
              <div key={epic.id} className={styles.epicCard}>
                <div className={styles.epicLeft}>
                  <span className={styles.epicIcon}>EPIC</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{epic.project_key}</span>
                  <span className={styles.epicTitle}>{epic.title}</span>
                </div>
                <div className={styles.epicRight}>
                  <div className={styles.epicMeta}>
                    <span className={`${styles.status} ${styles[epic.statusCls]}`}>{epic.status}</span>
                    <span className={styles.storiesCount}>{epic.linkedCount} histórias/tarefas vinculadas</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


