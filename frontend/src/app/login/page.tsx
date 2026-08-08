'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ShieldCheck, Mail, Lock, KeyRound, Eye, EyeOff, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();

  // Mode state
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Admin credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle Google Auth Sign In
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection popup
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      await loginWithGoogle(idToken);
    } catch (err: any) {
      console.error('Google login error:', err);
      // Clean up firebase canceled error messages
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelled. Please select a Google account in the popup.');
      } else {
        setError(err.message || 'Google Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Credentials Login
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let role: 'voter' | 'admin' | 'superadmin' = 'admin';
      if (email.trim() === 'supertech@admin.com') {
        role = 'superadmin';
      }
      await login(email.trim(), password, role);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify admin credentials.');
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
              HTU Elect <span style={{ color: 'var(--color-primary)' }}>✓</span>
            </span>
          </div>
          <h2 className="auth-title" style={{ marginTop: 'var(--space-4)' }}>
            {isAdminMode ? 'Administrator Sign In' : 'Voter Secure Login'}
          </h2>
          <p className="auth-subtitle">
            {isAdminMode
              ? 'Enter your department administrator credentials to access the console.'
              : 'Sign in instantly using your Google account to confirm identity and cast your ballot.'}
          </p>
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

        {!isAdminMode ? (
          /* VOTER GOOGLE AUTH MODE */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="btn btn-primary btn-full hover-lift"
              disabled={loading}
              style={{
                background: '#fff',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: 'var(--space-3) var(--space-4)',
                fontWeight: 600,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.63-1.05-1.41-1.18-2.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              {loading ? 'Authenticating...' : 'Sign In with Google'}
            </button>

            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: '1.5' }}>
              Only students and voters registered on the official EC voter lists will be granted access. Manual account creation is deprecated.
            </p>
          </div>
        ) : (
          /* ADMIN CREDENTIALS MODE */
          <form onSubmit={handleAdminSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Admin Email</label>
              <div className="form-input-container">
                <Mail size={18} className="form-input-icon" />
                <input
                  type="email"
                  id="login-email"
                  className="form-input form-input-with-icon"
                  placeholder="admin@htu.edu.gh"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="form-input-container" style={{ position: 'relative' }}>
                <Lock size={18} className="form-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="login-password"
                  className="form-input form-input-with-icon"
                  placeholder="••••••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading}>
              <KeyRound size={18} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
              {loading ? 'Signing In...' : 'Verify & Access Console'}
            </button>
          </form>
        )}

        <div style={{ marginTop: 'var(--space-6)', textAlign: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: 'var(--space-4)' }}>
          <button
            type="button"
            onClick={() => { setIsAdminMode(!isAdminMode); setError(''); }}
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-primary)',
              fontWeight: 'bold',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LogIn size={16} />
            {isAdminMode ? 'Switch to Voter Portal (Google)' : 'Switch to Admin Login (Credentials)'}
          </button>
        </div>

        <div className="auth-security-badge" style={{ marginTop: 'var(--space-6)' }}>
          <ShieldCheck size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
          Protected by HTU Elect Secure Authenticator ✓
        </div>
      </div>
    </div>
  );
}
