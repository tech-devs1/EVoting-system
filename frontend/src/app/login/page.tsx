'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Mail, Lock, KeyRound, School, Fingerprint } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Determine if logging in as admin or voter based on email
      const role = email.includes('admin') ? 'admin' : 'voter';
      await login(email, password, role);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleUniversityLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password, 'voter');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login('admin@Votick.ai', 'admin-pass', 'admin');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container animate-page-enter">
      <div className="auth-mesh"></div>
      
      <div className="glass-card-strong auth-card" style={{ maxWidth: '450px', width: '100%', margin: '0 auto' }}>
        <div className="auth-header">
          <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldCheck size={28} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>
              Votick <span style={{ color: 'var(--color-primary)' }}>✓</span>
            </span>
          </div>
          <h2 className="auth-title" style={{ marginTop: 'var(--space-4)' }}>Voter & Admin Portal</h2>
          <p className="auth-subtitle">Sign in to review credentials and submit your ballot.</p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ 
            padding: 'var(--space-3) var(--space-4)', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <div className="form-input-container">
              <Mail size={18} className="form-input-icon" />
              <input 
                type="email" 
                id="login-email" 
                className="form-input form-input-with-icon" 
                placeholder="id@htu.edu.gh" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Ballot Security Passphrase</label>
            <div className="form-input-container">
              <Lock size={18} className="form-input-icon" />
              <input 
                type="password" 
                id="login-password" 
                className="form-input form-input-with-icon" 
                placeholder="••••••••••••" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
            <label className="form-checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" className="form-checkbox" defaultChecked />
              <span style={{ fontSize: 'var(--text-sm)' }}>Remember this session</span>
            </label>
            <Link href="/forgot-password" style={{ fontSize: 'var(--text-sm)' }}>Forgot Key?</Link>
          </div>

          <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading}>
            <KeyRound size={18} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} /> 
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Don't have an account? </span>
          <Link href="/register" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            Register Account
          </Link>
        </div>

        <div className="auth-security-badge" style={{ marginTop: 'var(--space-6)' }}>
          <ShieldCheck size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> 
          Protected by Votick ✓ Security
        </div>
      </div>
    </div>
  );
}
