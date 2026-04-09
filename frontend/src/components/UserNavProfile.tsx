'use client';
import React, { useEffect, useState } from 'react';
import styles from '../app/dashboard/dashboard.module.css';

export default function UserNavProfile() {
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('http://localhost:4000/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.name) {
        setUserName(data.name);
        // Sync localstorage for other pages
        localStorage.setItem('userName', data.name);
      }
    })
    .catch(e => console.log('Error fetching user', e));
  }, []);

  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <div className={styles.userProfile}>
      <div className={styles.avatar}>{initials}</div>
      <span>{userName}</span>
    </div>
  );
}
