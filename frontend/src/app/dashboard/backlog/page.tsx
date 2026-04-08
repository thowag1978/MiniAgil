import React from 'react';
import styles from './backlog.module.css';

export default function BacklogPage() {
  return (
    <div className="animate-fade-in">
      <div className={styles.dashHeader}>
        <h1>Backlog do Projeto</h1>
        <div className={styles.actionBar}>
           <input type="text" className="input-glass" placeholder="🔍 Buscar epic, story ou tarefa..." style={{ maxWidth: '300px' }} />
           <button className="btn-primary">+ Criar Item</button>
        </div>
      </div>
      
      <div className={styles.sprintBoard}>
         <div className={styles.sprintHeader}>
            <div className={styles.sprintTitle}>
               <h3>Sprint Atual (Sprint 1)</h3>
               <span className={styles.sprintDates}>01 Abr - 15 Abr</span>
            </div>
            <button className={`btn-primary ${styles.btnOutline}`}>Concluir Sprint</button>
         </div>
         <div className={styles.issueList}>
             <div className={styles.issueCard}>
                <span className={`${styles.issueType} ${styles.typeStory}`}>STORY</span>
                <span className={styles.issueKey}>NXT-45</span>
                <span className={styles.issueTitle}>Implementar layout do Dashboard</span>
                <span className={styles.issuePriority}>Alta</span>
             </div>
             <div className={styles.issueCard}>
                <span className={`${styles.issueType} ${styles.typeTask}`}>TASK</span>
                <span className={styles.issueKey}>NXT-46</span>
                <span className={styles.issueTitle}>Revisar paleta de cores Dark Mode</span>
                <span className={styles.issuePriority}>Média</span>
             </div>
         </div>
      </div>

      <div className={styles.backlogBoard}>
         <div className={styles.sprintHeader}>
            <div className={styles.sprintTitle}>
               <h3>Backlog</h3>
               <span className={styles.sprintDates}>14 itens pendentes</span>
            </div>
            <button className={`btn-primary ${styles.btnOutline}`}>Criar Sprint</button>
         </div>
         <div className={styles.issueList}>
             <div className={styles.issueCard}>
                <span className={`${styles.issueType} ${styles.typeEpic}`}>EPIC</span>
                <span className={styles.issueKey}>NXT-10</span>
                <span className={styles.issueTitle}>Sistema de Pagamentos</span>
                <span className={styles.issuePriority}>Média</span>
             </div>
             <div className={styles.issueCard}>
                <span className={`${styles.issueType} ${styles.typeBug}`}>BUG</span>
                <span className={styles.issueKey}>NXT-50</span>
                <span className={styles.issueTitle}>Falha no login com token expirado</span>
                <span className={styles.issuePriority}>Crítica</span>
             </div>
             {/* Em um cenário real, aqui entraria a lib dnd-kit para arrastar e soltar */}
         </div>
      </div>
    </div>
  );
}
