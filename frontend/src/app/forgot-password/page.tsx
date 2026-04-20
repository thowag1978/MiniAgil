'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import styles from '../login/login.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('http://localhost:4000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Ocorreu um erro.');
      }
    } catch {
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
          <h1>Recuperar Senha</h1>
          <p>Informe seu e-mail para enviarmos um link de recuperação.</p>
        </div>
        
        {success ? (
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <p style={{ color: 'var(--brand)', fontWeight: 'bold' }}>Solicitação enviada!</p>
            <p style={{ fontSize: '0.9rem', marginTop: 10 }}>Se o e-mail existir, um link de recuperação foi enviado. (Verifique o terminal do backend no ambiente de desenvolvimento)</p>
            <Link href="/login" style={{ display: 'inline-block', marginTop: 20 }}>Voltar ao Login</Link>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {errorMsg && <div style={{color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(255,0,0,0.1)', padding: 8, borderRadius: 6}}>{errorMsg}</div>}
            
            <div className={styles.formGroup}>
              <label htmlFor="email">Email da sua conta</label>
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

            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Link'}
            </button>
          </form>
        )}
        
        {!success && (
          <div className={styles.footerInfo}>
            Lembrou a senha? <Link href="/login">Voltar ao Login</Link>
          </div>
        )}
      </main>
    </div>
  );
}
