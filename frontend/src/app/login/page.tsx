'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@miniagil.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // Faz a chamada diretamente para o nosso backend Node na porta 4000
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        // Salva o token localmente e redireciona (abordagem MVP)
        localStorage.setItem('token', data.token);
        if (data.user && data.user.name) {
          localStorage.setItem('userName', data.user.name);
        }
        // O Next.js router do app nativo
        window.location.href = '/dashboard';
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Credenciais inválidas!');
      }
    } catch (err) {
      setErrorMsg('Falha de conexão com o servidor. O backend está rodando?');
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
          <p>O ágil que você conhece, no design que você merece.</p>
        </div>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          {errorMsg && <div style={{color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(255,0,0,0.1)', padding: 8, borderRadius: 6}}>{errorMsg}</div>}
          
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
              placeholder="••••••••" 
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
          Não tem uma conta? <Link href="/register">Crie agora</Link>
        </div>
      </main>
    </div>
  );
}
