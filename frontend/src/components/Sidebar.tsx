import React from 'react';
import styles from './sidebar.module.css';

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <div className={styles.logoMark}></div>
        <h2>MiniAgil</h2>
      </div>
      
      <nav className={styles.nav}>
        <div className={styles.navSection}>PRINCIPAL</div>
        <a href="/dashboard" className={`${styles.navItem} ${styles.active}`}>Visão Geral</a>
        <a href="/dashboard/backlog" className={styles.navItem}>Backlog Ativo</a>
        <a href="/dashboard/board" className={styles.navItem}>Quadro Kanban</a>
        
        <div className={styles.navSection}>FAVORITOS</div>
        <a href="#" className={styles.navItem}>App Mobile (NXT)</a>
        <a href="#" className={styles.navItem}>Website (WEB)</a>
      </nav>
      
      <div className={styles.bottomArea}>
        <button className={styles.newBtn}>+ Novo Item</button>
      </div>
    </aside>
  );
}
