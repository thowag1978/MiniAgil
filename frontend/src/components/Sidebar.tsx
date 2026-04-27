'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import styles from './sidebar.module.css';
import CreateItemModal from './CreateItemModal';
import { queryKeys } from '@/lib/query/keys';

export default function Sidebar() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleSuccess = () => {
    setIsCreateModalOpen(false);
    queryClient.invalidateQueries({ queryKey: queryKeys.items });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
  };

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <div className={styles.logoMark}></div>
          <h2>MiniAgil</h2>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>PRINCIPAL</div>
          <Link href="/dashboard" className={styles.navItem}>Visão Geral</Link>
          <Link href="/dashboard/backlog" className={styles.navItem}>Backlog Ativo</Link>
          <Link href="/dashboard/hierarchical-backlog" className={styles.navItem}>Backlog Hierárquico</Link>
          <Link href="/dashboard/board" className={styles.navItem}>Quadro Kanban</Link>

          <div className={styles.navSection}>ADMINISTRAÇÃO</div>
          <Link href="/dashboard/users" className={styles.navItem}>Gestão de Usuários</Link>
        </nav>

        <div className={styles.bottomArea}>
          <button className={styles.newBtn} onClick={() => setIsCreateModalOpen(true)}>+ Novo Item</button>
        </div>
      </aside>

      {isCreateModalOpen && (
        <CreateItemModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}


