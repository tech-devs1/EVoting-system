'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ShieldCheck, FileCheck2, Users, BarChart3, Lock } from 'lucide-react';

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
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', overflowX: 'hidden', fontFamily: 'var(--font-sans, system-ui, sans-serif)', backgroundColor: '#ffffff' }}>
      {/* Left Column - Hero Branding */}
      <div style={{
        flex: '1.2',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '3rem 4rem',
        backgroundImage: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.78), rgba(15, 23, 42, 0.92)), url("/images/login_hero.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#ffffff'
      }} className="hidden-mobile">
        {/* Top Logo Badge */}
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <ShieldCheck size={26} style={{ color: '#2563eb' }} />
            <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
              HTU Elect <span style={{ color: '#2563eb' }}>✓</span>
            </span>
          </div>
        </div>

        {/* Hero Content */}
        <div style={{ maxWidth: '580px', margin: '3rem 0' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.15, marginBottom: '1.25rem', letterSpacing: '-0.03em', color: '#ffffff' }}>
            Empowering Tomorrow's Leaders
          </h1>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.6, color: 'rgba(241, 245, 249, 0.9)', marginBottom: '2.5rem' }}>
            Ho Technical University's official digital election portal — connecting voters, candidates, and electoral commissions in one secure place.
          </p>

          {/* Feature List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                <FileCheck2 size={20} style={{ color: '#60a5fa' }} />
              </div>
              <span style={{ fontSize: '1rem', color: '#f8fafc', fontWeight: 500 }}>Track applications, rosters & approvals end-to-end</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                <Users size={20} style={{ color: '#60a5fa' }} />
              </div>
              <span style={{ fontSize: '1rem', color: '#f8fafc', fontWeight: 500 }}>Coordinate electoral supervisors across departments</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                <BarChart3 size={20} style={{ color: '#60a5fa' }} />
              </div>
              <span style={{ fontSize: '1rem', color: '#f8fafc', fontWeight: 500 }}>Real-time voter turnout & cryptographic audit insights</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: '0.875rem', color: 'rgba(203, 213, 225, 0.7)' }}>
          © {new Date().getFullYear()} Ho Technical University. All rights reserved.
        </div>
      </div>

      {/* Right Column - Authentication Form */}
      <div style={{
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '3rem 2rem',
        backgroundColor: '#ffffff'
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          
          <div style={{ marginBottom: '2.5rem', textAlign: 'left' }}>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>
              Sign in
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748b' }}>
              Use your Google account to access the portal
            </p>
          </div>

          {error && (
            <div style={{
              padding: '0.875rem 1.125rem',
              borderRadius: '10px',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          {/* Form Card */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '2rem',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0,0,0,0.12)',
            border: '1px solid #f1f5f9',
            textAlign: 'center'
          }}>

            {!isAdminMode ? (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.875rem',
                    padding: '0.9rem 1.5rem',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    opacity: loading ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                    }
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.13C3.25 21.3 7.31 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.4l4.01-3.13z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4.01 3.13c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>{loading ? 'Authenticating...' : 'Sign in with Google'}</span>
                </button>

                <p style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                  HTU staff, EC admins, superadmins & registered voters all sign in here.
                </p>
              </>
            ) : (
              <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Admin Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@htu.edu.gh"
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: '0.5rem'
                  }}
                >
                  {loading ? 'Signing in...' : 'Sign In with Password'}
                </button>
              </form>
            )}

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                onClick={() => setIsAdminMode(!isAdminMode)}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <Lock size={14} />
                {isAdminMode ? 'Use Google Single Sign-On' : 'Password Login Fallback'}
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
