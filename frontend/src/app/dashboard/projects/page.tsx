'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import styles from './projects.module.css';
import CreateProjectModal from '../../../components/CreateProjectModal';
import { projectsApi } from '@/lib/api/projects';
import { queryKeys } from '@/lib/query/keys';
import type { Project } from '@/lib/types';

export default function ProjectsPortfolioPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
  });

  const projects = projectsQuery.data || [];

  return (
    <>
      <div className={`animate-fade-in ${styles.container}`}>
        <div className={styles.header}>
          <h1>Portfolio de Projetos</h1>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ Criar Projeto</button>
        </div>

        {projectsQuery.isLoading ? (
          <div>Carregando projetos...</div>
        ) : projectsQuery.isError ? (
          <div style={{ color: '#ff6b6b' }}>Falha ao carregar projetos.</div>
        ) : (
          <div className={styles.grid}>
            {projects.map((p: Project) => (
              <div key={p.id} className={styles.projectCard} onClick={() => router.push(`/dashboard/projects/${p.id}`)}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>{p.name}</div>
                  <div className={styles.cardKey}>{p.key_prefix}</div>
                </div>
                <div className={styles.cardDesc}>{p.description}</div>
                <div className={styles.stats}>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>-</span>
                    <span className={styles.statLabel}>Épicos Abertos</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>-</span>
                    <span className={styles.statLabel}>Sprints Ativas</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <CreateProjectModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}


