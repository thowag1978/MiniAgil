'use client';
import React from 'react';
import styles from './modal.module.css';

interface IssueModalProps {
  issue: any;
  onClose: () => void;
}

export default function IssueModal({ issue, onClose }: IssueModalProps) {
  if (!issue) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.issueKey}>{issue.key}</span>
            <span className={styles.separator}>/</span>
            <span className={styles.statusBadge}>{issue.status}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </header>

        <div className={styles.modalBody}>
          <div className={styles.mainContent}>
            <h1 className={styles.issueTitle}>{issue.title}</h1>
            
            <div className={styles.descriptionSection}>
              <h3>Descrição</h3>
              <div className={styles.descriptionText}>
                Esta é a descrição detalhada do ticket. No futuro, ela consumirá e renderizará conteúdo rich-text/markdown que foi salvo no banco de dados, além de anexos integrados com o MinIO local ou S3 cloud.
              </div>
            </div>

            <div className={styles.commentsSection}>
              <h3>Comentários</h3>
              <div className={styles.commentInputBox}>
                <textarea className="input-glass" placeholder="Adicionar um comentário..." rows={3}></textarea>
                <div style={{ marginTop: 10, textAlign: 'right' }}>
                  <button className="btn-primary">Salvar</button>
                </div>
              </div>
            </div>
          </div>
          
          <aside className={styles.sidebar}>
            <div className={styles.sidebarField}>
              <label>Responsável</label>
              <div className={styles.fieldValue}>
                <div className={styles.avatarMini}>T</div>
                <span>Thiago</span>
              </div>
            </div>
            <div className={styles.sidebarField}>
              <label>Relator</label>
              <div className={styles.fieldValue}>
                 <div className={styles.avatarMini}>M</div>
                 <span>Master</span>
              </div>
            </div>
            <div className={styles.sidebarField}>
              <label>Prioridade</label>
              <div className={styles.fieldValue}>🔴 Alta</div>
            </div>
            <div className={styles.sidebarField}>
              <label>Sprint</label>
              <div className={styles.fieldValue}>Sprint 1</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
