'use client';
import React, { useState } from 'react';
import styles from './sidebar.module.css';
import CreateItemModal from './CreateItemModal';

export default function Sidebar() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <div className={styles.logoMark}></div>
          <h2>MiniAgil</h2>
        </div>
        
        <nav className={styles.nav}>
          <div className={styles.navSection}>PRINCIPAL</div>
          <a href="/dashboard" className={`${styles.navItem}`}>Visão Geral</a>
          <a href="/dashboard/backlog" className={styles.navItem}>Backlog Ativo</a>
          <a href="/dashboard/hierarchical-backlog" className={styles.navItem}>Backlog Hierárquico</a>
          <a href="/dashboard/board" className={styles.navItem}>Quadro Kanban</a>
          
          <div className={styles.navSection}>FAVORITOS</div>
          <a href="#" className={styles.navItem}>App Mobile (NXT)</a>
          <a href="#" className={styles.navItem}>Website (WEB)</a>

          <div className={styles.navSection}>ADMINISTRAÇÃO</div>
          <a href="/dashboard/users" className={styles.navItem}>Gestão de Usuários</a>
        </nav>
        
        <div className={styles.bottomArea}>
          <button className={styles.newBtn} onClick={() => setIsCreateModalOpen(true)}>+ Novo Item</button>
        </div>
      </aside>

      {isCreateModalOpen && (
        <CreateItemModal 
          onClose={() => setIsCreateModalOpen(false)} 
          onSuccess={() => {
            setIsCreateModalOpen(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
