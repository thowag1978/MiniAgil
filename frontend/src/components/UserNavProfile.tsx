'use client';
import React from 'react';
import styles from '../app/dashboard/dashboard.module.css';
import { useAuth } from '@/lib/auth/AuthContext';

export default function UserNavProfile() {
  const { user } = useAuth();
  const userName = user?.name || 'User';
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <div className={styles.userProfile}>
      <div className={styles.avatar}>{initials}</div>
      <span>{userName}</span>
    </div>
  );
}


