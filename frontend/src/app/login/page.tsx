'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ShieldCheck, Lock } from 'lucide-react';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await loginWithGoogle(idToken);
    } catch (err: any) {
      console.error('Google login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelled. Please select your Google account in the popup.');
      } else {
        setError(err.message || 'Google Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let role: 'voter' | 'admin' | 'superadmin' = 'admin';
      if (email.trim() === 'supertech@admin.com' || email.trim() === 'issakasaddick14@gmail.com') {
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
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100vw',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'var(--bg-primary, #F8FAFC)',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
      padding: '1.5rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--bg-secondary, #ffffff)',
        borderRadius: 'var(--radius-xl, 12px)',
        border: '1px solid var(--border-color, #E2E8F0)',
        padding: '2.5rem 2rem',
        boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))'
      }}>

        {/* Header Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md, 8px)',
            backgroundColor: 'var(--color-primary-50, #EFF6FF)',
            color: 'var(--color-primary, #2563EB)',
            marginBottom: '1rem'
          }}>
            <ShieldCheck size={28} />
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'var(--weight-bold, 700)',
            color: 'var(--text-primary, #0F172A)',
            margin: '0 0 0.25rem 0',
            letterSpacing: '-0.02em'
          }}>
            HTU Elect
          </h2>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary, #475569)',
            margin: 0
          }}>
            Ho Technical University Electronic Voting Portal
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md, 8px)',
            marginBottom: '1.5rem',
            fontSize: 'var(--text-xs, 0.75rem)',
            backgroundColor: 'var(--color-danger-bg, #FEF2F2)',
            color: 'var(--color-danger, #EF4444)',
            border: '1px solid var(--border-error, #EF4444)',
            fontWeight: 'var(--weight-medium, 500)'
          }}>
            {error}
          </div>
        )}

        {/* Action Form */}
        {!isAdminMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1.25rem',
                backgroundColor: 'var(--bg-secondary, #ffffff)',
                color: 'var(--text-primary, #0F172A)',
                border: '1px solid var(--border-color, #E2E8F0)',
                borderRadius: 'var(--radius-lg, 10px)',
                fontSize: 'var(--text-sm, 0.875rem)',
                fontWeight: 'var(--weight-semibold, 600)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast, 100ms)',
                opacity: loading ? 0.7 : 1
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.13C3.25 21.3 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.4l4.01-3.13z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4.01 3.13c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>{loading ? 'Authenticating...' : 'Sign in with Google'}</span>
            </button>

            <p style={{
              fontSize: 'var(--text-xs, 0.75rem)',
              color: 'var(--text-secondary, #475569)',
              textAlign: 'center',
              lineHeight: '1.4',
              margin: 0
            }}>
              Accessible to HTU staff, EC administrators, and registered voters via Google Single Sign-On.
            </p>
          </div>
        ) : (
          <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: 'var(--text-xs, 0.75rem)',
                fontWeight: 'var(--weight-semibold, 600)',
                color: 'var(--text-secondary, #475569)',
                marginBottom: '0.375rem'
              }}>
                Administrator Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@htu.edu.gh"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--border-color, #E2E8F0)',
                  backgroundColor: 'var(--bg-input, #FFFFFF)',
                  color: 'var(--text-primary, #0F172A)',
                  fontSize: 'var(--text-sm, 0.875rem)'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: 'var(--text-xs, 0.75rem)',
                fontWeight: 'var(--weight-semibold, 600)',
                color: 'var(--text-secondary, #475569)',
                marginBottom: '0.375rem'
              }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--border-color, #E2E8F0)',
                  backgroundColor: 'var(--bg-input, #FFFFFF)',
                  color: 'var(--text-primary, #0F172A)',
                  fontSize: 'var(--text-sm, 0.875rem)'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--color-primary, #2563EB)',
                color: 'var(--text-inverse, #ffffff)',
                border: 'none',
                borderRadius: 'var(--radius-md, 8px)',
                fontWeight: 'var(--weight-semibold, 600)',
                fontSize: 'var(--text-sm, 0.875rem)',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Signing in...' : 'Sign In with Password'}
            </button>
          </form>
        )}

        {/* Bottom Toggle Link */}
        <div style={{
          marginTop: '1.75rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-color, #E2E8F0)',
          textAlign: 'center'
        }}>
          <button
            type="button"
            onClick={() => setIsAdminMode(!isAdminMode)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary, #2563EB)',
              fontSize: 'var(--text-xs, 0.75rem)',
              fontWeight: 'var(--weight-semibold, 600)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem'
            }}
          >
            <Lock size={12} />
            {isAdminMode ? 'Use Google Single Sign-On' : 'Password Login Fallback'}
          </button>
        </div>

      </div>
    </div>
  );
}
