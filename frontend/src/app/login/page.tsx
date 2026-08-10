'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ShieldCheck, Lock } from 'lucide-react';

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
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
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-md, 8px)',
            backgroundColor: 'var(--color-primary-50, #EFF6FF)',
            color: 'var(--color-primary, #2563EB)',
            marginBottom: '1.25rem'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h2 style={{
            fontSize: '1.625rem',
            fontWeight: 'var(--weight-bold, 700)',
            color: 'var(--text-primary, #0F172A)',
            margin: '0 0 0.5rem 0',
            letterSpacing: '-0.02em'
          }}>
            HTU Elect
          </h2>
          <p style={{
            fontSize: 'var(--text-sm, 0.875rem)',
            color: 'var(--text-secondary, #475569)',
            margin: 0,
            lineHeight: 1.4
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

        {/* Action Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
              padding: '0.9rem 1.25rem',
              backgroundColor: 'var(--color-primary, #2563EB)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-lg, 10px)',
              fontSize: 'var(--text-sm, 0.875rem)',
              fontWeight: 'var(--weight-semibold, 600)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast, 100ms)',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.15)',
              opacity: loading ? 0.7 : 1
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ filter: 'brightness(0) invert(1)' }}>
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.13C3.25 21.3 7.31 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.4l4.01-3.13z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4.01 3.13c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span>{loading ? 'Authenticating...' : 'Sign In with Google'}</span>
          </button>

          <p style={{
            fontSize: 'var(--text-xs, 0.75rem)',
            color: 'var(--text-secondary, #475569)',
            textAlign: 'center',
            lineHeight: '1.5',
            margin: 0
          }}>
            Unified login portal for voters, department executives, and system administrators via secure Google Authentication.
          </p>
        </div>

      </div>
    </div>
  );
}
