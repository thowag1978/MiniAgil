'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import { useAuth } from '@/lib/auth/AuthContext';
import { ApiError } from '@/lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@miniagil.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      await login({ email, password });
      router.replace('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMsg(error.message || 'Credenciais invÃ¡lidas!');
      } else {
        setErrorMsg('Falha de conexÃ£o com o servidor. O backend estÃ¡ rodando?');
      }
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
          <h1>Bem-vindo ao MiniAgil</h1>
          <p>O Ã¡gil que vocÃª conhece, no design que vocÃª merece.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {errorMsg && <div style={{ color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(255,0,0,0.1)', padding: 8, borderRadius: 6 }}>{errorMsg}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="email">Email de trabalho</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-glass"
              placeholder="nome@empresa.com"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-glass"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -10, marginBottom: 20 }}>
            <Link href="/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--brand)', textDecoration: 'none' }}>
              Esqueceu a senha?
            </Link>
          </div>

          <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
            {loading ? 'Acessando...' : 'Entrar no Workspace'}
          </button>
        </form>

        <div className={styles.footerInfo}>
          NÃ£o tem uma conta? <Link href="/register">Crie agora</Link>
        </div>
      </main>
    </div>
  );
}


