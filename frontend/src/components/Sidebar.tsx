'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import styles from './sidebar.module.css';
import CreateItemModal from './CreateItemModal';
import { queryKeys } from '@/lib/query/keys';
import { useAuth } from '@/lib/auth/AuthContext';

const mainNavItems = [
  { href: '/dashboard', label: 'Visão Geral', exact: true },
  { href: '/dashboard/projects', label: 'Projetos' },
  { href: '/dashboard/backlog', label: 'Backlog Ativo' },
  { href: '/dashboard/hierarchical-backlog', label: 'Backlog Hierárquico' },
  { href: '/dashboard/sprint', label: 'Sprint' },
  { href: '/dashboard/board', label: 'Quadro Kanban' },
];

const adminNavItems = [
  { href: '/dashboard/users', label: 'Gestão de Usuários' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleSuccess = () => {
    setIsCreateModalOpen(false);
    queryClient.invalidateQueries({ queryKey: queryKeys.items });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
  };

  const getNavClassName = (href: string, exact?: boolean) => {
    const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return isActive ? `${styles.navItem} ${styles.active}` : styles.navItem;
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
          {mainNavItems.map((item) => (
            <Link key={item.href} href={item.href} className={getNavClassName(item.href, item.exact)}>
              {item.label}
            </Link>
          ))}

          {user?.role === 'ADMIN' && (
            <>
              <div className={styles.navSection}>ADMINISTRAÇÃO</div>
              {adminNavItems.map((item) => (
                <Link key={item.href} href={item.href} className={getNavClassName(item.href)}>
                  {item.label}
                </Link>
              ))}
            </>
          )}
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


