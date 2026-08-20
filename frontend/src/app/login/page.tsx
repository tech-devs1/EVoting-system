'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Building2, ArrowRight, User, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, googleLogin } = useAuth();

  // ── Flow State (No OTP) ──
  const [step, setStep] = useState<'identifier' | 'admin-password' | 'voter-verify'>('identifier');
  
  const [identifier, setIdentifier] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  
  // Student details retrieved
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  // Admin password state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Messages & Loading
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch departments on mount
  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await apiRequest<{ status: string; data: { id: string; name: string }[] }>('/auth/departments');
        if (res.status === 'success') {
          setDepartments(res.data || []);
          setSelectedTenant('');
        }
      } catch (err) {
        console.error('Failed to load departments', err);
        setDepartments([]);
      }
    }
    loadDepts();
  }, []);

  const handleTenantChange = (tenantId: string) => {
    setSelectedTenant(tenantId);
    if (tenantId) {
      localStorage.setItem('COMPSSA_tenantId', tenantId);
    }
  };

  // ── Step 1: Verify Identifier (Index Number or Admin Email) ──
  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) { setError('Please choose your department before proceeding.'); return; }
    if (!identifier.trim()) { setError('Index Number or Email Address is required'); return; }

    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ 
        status: string; 
        isAdmin?: boolean; 
        isVoter?: boolean; 
        data?: { studentId: string; name: string; email: string };
        message?: string; 
      }>('/auth/verify-student', 'POST', { identifier });

      if (res.status === 'success') {
        if (res.isAdmin) {
          // Administrator identified
          setStep('admin-password');
        } else if (res.isVoter && res.data) {
          // Student identified
          setStudentId(res.data.studentId);
          setStudentName(res.data.name);
          setStudentEmail(res.data.email);
          setStep('voter-verify');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 Student: Google Native Sign-In via Firebase Auth ──
  const handleGoogleSignInClick = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account' // Forces Google's native account chooser modal on mobile and desktop
      });
      
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const userEmail = result.user.email || undefined;
      
      // Backend validates that the chosen Google account matches the student's email
      await googleLogin(studentId, idToken, undefined, userEmail);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setError('Google Sign-In popup was closed before completing.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Google Sign-In popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setError(err.message || 'Google Sign-In failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 Admin: Password Authentication (Direct, No OTP) ──
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let role: 'voter' | 'admin' | 'superadmin' = 'admin';
      if (identifier.trim().toLowerCase() === 'supertech@admin.com') {
        role = 'superadmin';
      }
      await login(identifier.trim(), password, role);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  const selectedDeptName = departments.find(d => d.id === selectedTenant)?.name;

  return (
    <div className="auth-container animate-page-enter">
      <div className="auth-mesh"></div>
      
      <div className="glass-card-strong auth-card" style={{ maxWidth: '480px', width: '100%', margin: '0 auto' }}>
        <div className="auth-header">
          <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldCheck size={28} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--text-xl)', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              {selectedDeptName} <span style={{ color: 'var(--color-primary)' }}>✓</span>
            </span>
          </div>

          <h2 className="auth-title" style={{ marginTop: 'var(--space-6)' }}>
            {step === 'identifier' && 'Sign In'}
            {step === 'admin-password' && 'Admin Authentication'}
            {step === 'voter-verify' && 'Confirm Your Identity'}
          </h2>
          <p className="auth-subtitle">
            {step === 'identifier' && 'Select your department and enter your index number or admin email.'}
            {step === 'admin-password' && `Enter the administrator password for ${identifier}.`}
            {step === 'voter-verify' && 'Confirm your student details and sign in with Google.'}
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
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        {/* STEP 1: Select Department + Enter Index / Email */}
        {step === 'identifier' && (
          <form onSubmit={handleIdentifierSubmit}>
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="dept-select">Department / Faculty</label>
              <div className="form-input-container">
                <Building2 size={18} className="form-input-icon" />
                <select
                  id="dept-select"
                  className="form-input form-input-with-icon"
                  required
                  value={selectedTenant}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  style={{
                    appearance: 'auto',
                    paddingRight: '24px',
                    borderColor: !selectedTenant ? 'rgba(239, 68, 68, 0.4)' : undefined
                  }}
                >
                  <option value="" disabled>Choose your department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              {/* Notification in red to choose the right department */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '6px',
                color: '#dc2626',
                fontSize: '0.8rem',
                fontWeight: 600,
                lineHeight: '1.3'
              }}>
                <AlertCircle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                <span>Please choose your right department before proceeding.</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-id">Student Index Number</label>
              <div className="form-input-container">
                <Mail size={18} className="form-input-icon" />
                <input
                  type="text"
                  id="login-id"
                  className="form-input form-input-with-icon"
                  placeholder="e.g. 032.... or .....@htu.edu.gh"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
                * Students: Enter your school index number (e.g. 032....).
              </p>
            </div>

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading} style={{ marginTop: 'var(--space-2)' }}>
              {loading ? 'Verifying Records...' : 'Verify & Proceed'} <ArrowRight size={18} style={{ marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
            </button>
          </form>
        )}

        {/* STEP 2 ADMIN: Password Check (Direct login, no OTP) */}
        {step === 'admin-password' && (
          <form onSubmit={handleAdminSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Administrator Password</label>
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

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading} style={{ marginTop: 'var(--space-4)' }}>
              {loading ? 'Signing In...' : 'Sign In as Administrator'}
            </button>

            <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
              <button type="button" onClick={() => { setStep('identifier'); setError(''); setPassword(''); }}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Back to Index / Email
              </button>
            </div>
          </form>
        )}

        {/* STEP 2 STUDENT: Confirm Details & Sign in with Google (Google handles popup & account selection) */}
        {step === 'voter-verify' && (
          <div>
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
              marginBottom: 'var(--space-5)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: 'var(--color-primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <User size={26} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)', marginBottom: '2px' }}>{studentName}</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', fontWeight: 500 }}>{studentEmail}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-color)' }}>
                <div>Index No: <strong style={{ color: 'var(--text-primary)' }}>{studentId}</strong></div>
                <div>Dept: <strong style={{ color: 'var(--text-primary)' }}>{selectedDeptName}</strong></div>
              </div>
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>
              Click below to authenticate with your Google account matching <strong style={{ color: 'var(--text-primary)' }}>{studentEmail}</strong>:
            </p>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              className="btn btn-full hover-lift"
              disabled={loading}
              style={{
                background: '#ffffff',
                color: '#3c4043',
                border: '1px solid #dadce0',
                fontWeight: 600,
                fontSize: 'var(--text-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '14px 20px',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                cursor: 'pointer'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {loading ? 'Connecting to Google...' : 'Sign in with Google'}
            </button>

            <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
              <button type="button" onClick={() => { setStep('identifier'); setError(''); }}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Change Index Number
              </button>
            </div>
          </div>
        )}

        <div className="auth-security-badge" style={{ marginTop: 'var(--space-6)' }}>
          <ShieldCheck size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
          Protected by TECHDEVS ✓ Security
        </div>
      </div>
    </div>
  );
}
