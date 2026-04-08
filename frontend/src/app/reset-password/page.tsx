'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../login/login.module.css';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    // We use window.location here to easily grab the URL search params on client-side
    // without triggering Next.js static build suspense boundaries for searchParams
    const searchParams = new URLSearchParams(window.location.search);
    setToken(searchParams.get('token') || '');
    setEmail(searchParams.get('email') || '');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMsg('As senhas não coincidem!');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('http://localhost:4000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword })
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Token inválido ou expirado.');
      }
    } catch (err) {
      setErrorMsg('Falha de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.blob1}></div>
      <div className={styles.blob2}></div>
      
      <main className={`card-glass animate-fade-in ${styles.loginCard}`}>
        <div className={styles.header}>
          <div className={styles.logo}></div>
          <h1>Nova Senha</h1>
          <p>Defina sua nova senha de acesso.</p>
        </div>
        
        {success ? (
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <p style={{ color: 'var(--brand)', fontWeight: 'bold' }}>Senha alterada com sucesso!</p>
            <Link href="/login" style={{ display: 'inline-block', marginTop: 20 }}>Fazer Login</Link>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {errorMsg && <div style={{color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(255,0,0,0.1)', padding: 8, borderRadius: 6}}>{errorMsg}</div>}
            
            <div className={styles.formGroup}>
              <label htmlFor="newPassword">Nova Senha</label>
              <input 
                type="password" 
                id="newPassword" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="input-glass" 
                placeholder="••••••••" 
                required
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Confirme a Nova Senha</label>
              <input 
                type="password" 
                id="confirmPassword" 
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="input-glass" 
                placeholder="••••••••" 
                required
              />
            </div>

            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading || !token}>
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
            {!token && <div style={{ textAlign: 'center', marginTop: 10, color: 'var(--text-dim)', fontSize: '0.8rem' }}>Token de recuperação não encontrado.</div>}
          </form>
        )}
      </main>
    </div>
  );
}
