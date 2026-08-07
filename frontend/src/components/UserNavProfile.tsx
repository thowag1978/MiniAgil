'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import styles from '../app/dashboard/dashboard.module.css';
import { useAuth } from '@/lib/auth/AuthContext';

export default function UserNavProfile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const userName = user?.name || 'User';
  const initials = userName.slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className={styles.userProfile}>
      <div className={styles.avatar}>{initials}</div>
      <span>{userName}</span>
      <button type="button" className={styles.logoutButton} onClick={handleLogout}>
        Sair
      </button>
    </div>
  );
}


