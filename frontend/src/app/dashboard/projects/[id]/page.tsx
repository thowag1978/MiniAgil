'use client';
import React, { useState, useEffect } from 'react';
import styles from './detail.module.css';

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<any>(null);
  const [epics, setEpics] = useState<any[]>([]);

  useEffect(() => {
    // Mocking specific project visualization based on ID
    setTimeout(() => {
      setProject({
        id: params.id,
        name: params.id === 'proj-1' ? 'MiniAgil Platform HQ' : 'Projeto Hub Corporativo',
        key_prefix: params.id === 'proj-1' ? 'MINI' : 'HUB',
        description: 'Repositório central gerindo roadmap, épicos e visões executivas.'
      });
      
      setEpics([
        { id: 'epic-1', key: 'MINI-10', title: 'Estruturação Core da Plataforma', status: 'CONCLUÍDO', stories: 8, statusCls: 'done' },
        { id: 'epic-2', key: 'MINI-15', title: 'Integração de Faturamento e Billing', status: 'EM PROGRESSO', stories: 12, statusCls: 'prog' },
        { id: 'epic-3', key: 'MINI-22', title: 'Aplicativo Mobile Nativo', status: 'A FAZER', stories: 0, statusCls: 'todo' }
      ]);
    }, 400);
  }, [params.id]);

  if (!project) return <div>Carregando visão de projeto...</div>;

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
           <a href="/dashboard/projects">Projetos</a> &gt; <span>{project.key_prefix}</span>
        </div>
        <div className={styles.titleRow}>
          <h1>{project.name}</h1>
          <span className={styles.keyBadge}>{project.key_prefix}</span>
        </div>
        <div className={styles.desc}>
          {project.description}
        </div>
      </div>

      <div className={styles.epicsSection}>
        <div className={styles.sectionHeader}>
          <h2>Épicos Deste Projeto</h2>
          <button className="btn-primary">+ Criar Épico</button>
        </div>
        
        <div className={styles.epicList}>
          {epics.map(epic => (
            <div key={epic.id} className={styles.epicCard}>
              <div className={styles.epicLeft}>
                <span className={styles.epicIcon}>EPIC</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{epic.key}</span>
                <span className={styles.epicTitle}>{epic.title}</span>
              </div>
              <div className={styles.epicRight}>
                <div className={styles.epicMeta}>
                  <span className={`${styles.status} ${styles[epic.statusCls]}`}>{epic.status}</span>
                  <span className={styles.storiesCount}>{epic.stories} Histórias/Tarefas vinculadas</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
