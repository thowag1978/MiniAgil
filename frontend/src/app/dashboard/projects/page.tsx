'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './projects.module.css';
import CreateProjectModal from '../../../components/CreateProjectModal';

interface Project {
  id: string;
  name: string;
  key_prefix: string;
  description?: string | null;
  epicsCount?: number;
  sprintsCount?: number;
}

export default function ProjectsPortfolioPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:4000/api/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data: Project[] = await res.json();
          setProjects(data);
        } else {
          console.error('Falha ao carregar projetos');
          setProjects([]);
        }
      } catch (err) {
        console.error('Erro de conexao ao carregar projetos', err);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return (
    <>
      <div className={`animate-fade-in ${styles.container}`}>
        <div className={styles.header}>
          <h1>Portfolio de Projetos</h1>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ Criar Projeto</button>
        </div>

        {loading ? (
          <div>Carregando projetos...</div>
        ) : (
          <div className={styles.grid}>
            {projects.map(p => (
              <div
                key={p.id}
                className={styles.projectCard}
                onClick={() => router.push(`/dashboard/projects/${p.id}`)}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>{p.name}</div>
                  <div className={styles.cardKey}>{p.key_prefix}</div>
                </div>
                <div className={styles.cardDesc}>
                  {p.description}
                </div>
                <div className={styles.stats}>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>{p.epicsCount || 0}</span>
                    <span className={styles.statLabel}>Epicos Abertos</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>{p.sprintsCount || 0}</span>
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
          onSuccess={(newProj) => {
            setProjects(prev => [newProj, ...prev]);
            setIsModalOpen(false);
          }}
        />
      )}
    </>
  );
}
