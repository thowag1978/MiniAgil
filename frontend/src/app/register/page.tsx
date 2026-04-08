'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import styles from '../login/login.module.css';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('http://localhost:4000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Erro ao criar conta!');
      }
    } catch (err) {
      setErrorMsg('Falha de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.container}>
        <main className={`card-glass animate-fade-in ${styles.loginCard}`}>
          <h2 style={{color: 'var(--brand)', textAlign: 'center'}}>Conta criada com sucesso!</h2>
          <p style={{textAlign: 'center', marginTop: 10}}>Redirecionando para o login...</p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.blob1}></div>
      <div className={styles.blob2}></div>
      
      <main className={`card-glass animate-fade-in ${styles.loginCard}`}>
        <div className={styles.header}>
          <div className={styles.logo}></div>
          <h1>Criar Conta</h1>
          <p>Junte-se ao MiniAgil hoje mesmo.</p>
        </div>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          {errorMsg && <div style={{color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(255,0,0,0.1)', padding: 8, borderRadius: 6}}>{errorMsg}</div>}
          
          <div className={styles.formGroup}>
            <label htmlFor="name">Seu Nome</label>
            <input 
              type="text" 
              id="name" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-glass" 
              placeholder="João Silva" 
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
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

          <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
            {loading ? 'Criando...' : 'Criar minha conta'}
          </button>
        </form>
        
        <div className={styles.footerInfo}>
          Já tem uma conta? <Link href="/login">Entre aqui</Link>
        </div>
      </main>
    </div>
  );
}
