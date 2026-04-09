import React from 'react';
import Sidebar from '../../components/Sidebar';
import UserNavProfile from '../../components/UserNavProfile';
import styles from './dashboard.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>Dashboard &gt; Visão Geral</div>
          <UserNavProfile />
        </header>
        <main className={styles.pageContent}>
          {children}
        </main>
      </div>
    </div>
  );
}
