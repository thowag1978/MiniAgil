'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './detail.module.css';

interface Project {
  id: string;
  name: string;
  key_prefix: string;
  description?: string | null;
}

interface Epic {
  id: string;
  project_key: string;
  title: string;
  workflow_status?: {
    name?: string;
  } | null;
  children?: Array<{ id: string }>;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;

    const fetchProjectData = async () => {
      setLoading(true);
      setError('');

      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const [projectRes, epicsRes] = await Promise.all([
          fetch(`http://localhost:4000/api/projects/${projectId}`, { headers }),
          fetch(`http://localhost:4000/api/items/hierarchical?project_id=${projectId}`, { headers }),
        ]);

        if (!projectRes.ok) {
          throw new Error('Falha ao carregar detalhes do projeto');
        }

        const projectData: Project = await projectRes.json();
        setProject(projectData);

        if (epicsRes.ok) {
          const epicData: Epic[] = await epicsRes.json();
          setEpics(epicData);
        } else {
          setEpics([]);
        }
      } catch (err) {
        console.error(err);
        setError('Nao foi possivel carregar os dados do projeto.');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId]);

  const normalizedEpics = useMemo(() => {
    return epics.map(epic => {
      const status = epic.workflow_status?.name || 'A FAZER';
      const statusCls = status === 'CONCLUIDO' || status === 'CONCLUÍDO'
        ? 'done'
        : status === 'EM PROGRESSO'
          ? 'prog'
          : 'todo';

      return {
        ...epic,
        status,
        statusCls,
        linkedCount: epic.children?.length || 0,
      };
    });
  }, [epics]);

  if (loading) return <div>Carregando visao de projeto...</div>;
  if (error) return <div>{error}</div>;
  if (!project) return <div>Projeto nao encontrado.</div>;

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/dashboard/projects">Projetos</Link> &gt; <span>{project.key_prefix}</span>
        </div>
        <div className={styles.titleRow}>
          <h1>{project.name}</h1>
          <span className={styles.keyBadge}>{project.key_prefix}</span>
        </div>
        <div className={styles.desc}>
          {project.description || 'Sem descricao cadastrada.'}
        </div>
      </div>

      <div className={styles.epicsSection}>
        <div className={styles.sectionHeader}>
          <h2>Epicos Deste Projeto</h2>
        </div>

        <div className={styles.epicList}>
          {normalizedEpics.length === 0 ? (
            <div>Nenhum epico encontrado para este projeto.</div>
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
                    <span className={styles.storiesCount}>{epic.linkedCount} historias/tarefas vinculadas</span>
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
