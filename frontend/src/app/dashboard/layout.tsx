'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import UserNavProfile from '../../components/UserNavProfile';
import styles from './dashboard.module.css';
import { useAuth } from '@/lib/auth/AuthContext';

const pageTitles = [
  { href: '/dashboard/projects', label: 'Projetos' },
  { href: '/dashboard/backlog', label: 'Backlog Ativo' },
  { href: '/dashboard/hierarchical-backlog', label: 'Backlog Hierárquico' },
  { href: '/dashboard/sprint', label: 'Sprint' },
  { href: '/dashboard/board', label: 'Quadro Kanban' },
  { href: '/dashboard/bugs/kanban', label: 'Kanban de Bugs' },
  { href: '/dashboard/bugs', label: 'Bugs' },
  { href: '/dashboard/users', label: 'Gestão de Usuários' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return <div style={{ padding: 24 }}>Validando sessÃ£o...</div>;
  }

  const currentPage = pageTitles.find((page) => pathname === page.href || pathname.startsWith(`${page.href}/`))?.label || 'Visão Geral';

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>Dashboard &gt; {currentPage}</div>
          <UserNavProfile />
        </header>
        <main className={styles.pageContent}>
          {children}
        </main>
      </div>
    </div>
  );
}

