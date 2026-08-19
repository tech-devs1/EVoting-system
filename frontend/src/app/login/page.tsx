'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { ShieldCheck, Mail, Lock, KeyRound, CheckCircle2, Eye, EyeOff, Hash, Building2, ArrowRight, User } from 'lucide-react';
import Script from 'next/script';

export default function LoginPage() {
  const { login, requestOtp, verifyOtp } = useAuth();

  // ── Unified Login flow state ──
  const [step, setStep] = useState<'identifier' | 'admin-password' | 'voter-verify' | 'otp'>('identifier');
  
  const [identifier, setIdentifier] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  
  // Voter details retrieved
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [fallbackOtp, setFallbackOtp] = useState('');

  // Admin password state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP Verification state (shared)
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Messages / Loading
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  // Fetch departments on mount
  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await apiRequest<{ status: string; data: { id: string; name: string }[] }>('/auth/departments');
        if (res.status === 'success') {
          setDepartments(res.data);
          if (res.data.length > 0) {
            const stored = localStorage.getItem('COMPSSA_tenantId');
            const defaultDept = res.data.find(d => d.id === stored) || res.data[0];
            setSelectedTenant(defaultDept.id);
            localStorage.setItem('COMPSSA_tenantId', defaultDept.id);
          }
        }
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    }
    loadDepts();
  }, []);

  const handleTenantChange = (tenantId: string) => {
    setSelectedTenant(tenantId);
    localStorage.setItem('COMPSSA_tenantId', tenantId);
  };

  // ── Step 1: Handle Identifier submission (Voter check vs Admin check) ──
  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) { setError('Index Number or Email Address is required'); return; }
    if (!selectedTenant) { setError('Please select a department'); return; }

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
          // It's an administrator
          setStep('admin-password');
        } else if (res.isVoter && res.data) {
          // It's a student/voter
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

  // ── Step 2 Voter: Send OTP via Email ──
  const handleSendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await requestOtp(studentId);
      if (result?.otpRequired && result.email) {
        setOtpEmail(result.email);
        setFallbackOtp(result.fallbackOtp || '');
        setStep('otp');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 Voter: Google Sign-In ──
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const hasRealGoogleAuth = typeof window !== 'undefined'
      && !!(window as any).google?.accounts?.id
      && !!googleClientId;

    try {
      if (hasRealGoogleAuth) {
        // Real Google Sign-In flow
        (window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            try {
              const result = await requestOtp(studentId, response.credential);
              if (result?.otpRequired && result.email) {
                setOtpEmail(result.email);
                setFallbackOtp(result.fallbackOtp || '');
                setStep('otp');
              }
            } catch (err: any) {
              setError(err.message || 'Google Sign-In failed.');
            } finally {
              setLoading(false);
            }
          }
        });
        // Handle prompt dismissal
        (window as any).google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
            setLoading(false);
            setError('Google Sign-In was dismissed. Please try again or use OTP.');
          }
        });
      } else {
        // No NEXT_PUBLIC_GOOGLE_CLIENT_ID configured — use mock token flow
        const result = await requestOtp(studentId, `MOCK_GOOGLE_${studentEmail}`);
        if (result?.otpRequired && result.email) {
          setOtpEmail(result.email);
          setFallbackOtp(result.fallbackOtp || '');
          setStep('otp');
        }
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed.');
      setLoading(false);
    }
  };

  // ── Step 2 Admin: Verify password ──
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let role: 'voter' | 'admin' | 'superadmin' = 'admin';
      if (identifier.trim().toLowerCase() === 'supertech@admin.com') {
        role = 'superadmin';
      }
      const result = await login(identifier.trim(), password, role);
      if (result?.otpRequired && result.email) {
        setOtpEmail(result.email);
        setFallbackOtp(result.fallbackOtp || '');
        setStep('otp');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: OTP Verification ──
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) { setError('Please enter the full 6-digit code.'); return; }
    setError('');
    setLoading(true);
    try {
      await verifyOtp(otpEmail, otpCode);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    setError('');
    try {
      await apiRequest('/auth/resend-otp', 'POST', { email: otpEmail });
      setResendMsg('A new code has been sent to your email.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP.');
    }
  };

  // OTP inputs
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    pasted.split('').forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const selectedDeptName = departments.find(d => d.id === selectedTenant)?.name || 'VoteTrust';

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
            {step === 'admin-password' && 'Enter Password'}
            {step === 'voter-verify' && 'Confirm Identity'}
            {step === 'otp' && 'Verify Security Code'}
          </h2>
          <p className="auth-subtitle">
            {step === 'identifier' && 'Enter your index number or institutional email address.'}
            {step === 'admin-password' && `Please enter the administrator password for ${identifier}.`}
            {step === 'voter-verify' && 'Please confirm your student details to proceed.'}
            {step === 'otp' && `Enter the 6-digit verification code sent to ${otpEmail}.`}
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

        {resendMsg && (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            border: '1px solid rgba(34,197,94,0.2)'
          }}>
            {resendMsg}
          </div>
        )}

        {/* STEP 1: Select Department and Enter Index / Email */}
        {step === 'identifier' && (
          <form onSubmit={handleIdentifierSubmit}>
            {departments.length > 0 && (
              <div className="form-group">
                <label className="form-label" htmlFor="dept-select">Department / School</label>
                <div className="form-input-container">
                  <Building2 size={18} className="form-input-icon" />
                  <select
                    id="dept-select"
                    className="form-input form-input-with-icon"
                    required
                    value={selectedTenant}
                    onChange={(e) => handleTenantChange(e.target.value)}
                    style={{ appearance: 'auto', paddingRight: '24px' }}
                  >
                    <option value="" disabled>Select your department...</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="login-id">Index Number or Email Address</label>
              <div className="form-input-container">
                <Mail size={18} className="form-input-icon" />
                <input
                  type="text"
                  id="login-id"
                  className="form-input form-input-with-icon"
                  placeholder="e.g. 0324080516 or admin@htu.edu.gh"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading} style={{ marginTop: 'var(--space-2)' }}>
              {loading ? 'Verifying...' : 'Verify & Proceed'} <ArrowRight size={18} style={{ marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
            </button>
          </form>
        )}

        {/* STEP 2 ADMIN: Admin password check */}
        {step === 'admin-password' && (
          <form onSubmit={handleAdminSubmit}>
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

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading} style={{ marginTop: 'var(--space-4)' }}>
              {loading ? 'Authenticating...' : 'Sign In as Admin'}
            </button>

            <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
              <button type="button" onClick={() => { setStep('identifier'); setError(''); setPassword(''); }}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Back
              </button>
            </div>
          </form>
        )}

        {/* STEP 2 VOTER: Display voter details & Auth methods */}
        {step === 'voter-verify' && (
          <div>
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-4)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'var(--color-primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <User size={24} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{studentName}</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{studentEmail}</p>
                </div>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                Index: <strong>{studentId}</strong> &bull; {selectedDeptName}
              </p>
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>
              Choose a verification method to sign in:
            </p>

            <button
              onClick={handleSendOtp}
              className="btn btn-primary btn-full hover-lift"
              disabled={loading}
              style={{ marginBottom: 'var(--space-3)' }}
            >
              <Mail size={18} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
              {loading ? 'Sending...' : 'Send OTP Code to Email'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-2) 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              className="btn btn-full hover-lift"
              disabled={loading}
              style={{
                marginTop: 'var(--space-2)',
                background: '#fff',
                color: '#3c4043',
                border: '1px solid #dadce0',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '12px 16px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {loading ? 'Connecting...' : 'Sign in with Google'}
            </button>

            <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
              <button type="button" onClick={() => { setStep('identifier'); setError(''); }}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OTP Code input */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: 'var(--color-primary-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-4) auto'
              }}>
                <CheckCircle2 size={30} style={{ color: 'var(--color-primary)' }} />
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Check your email{otpEmail ? ` (${otpEmail})` : ''} — a 6-digit verification code has been sent. It expires in <strong>10 minutes</strong>.
              </p>
            </div>

            {fallbackOtp && (
              <div style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-sm)',
                background: 'rgba(245, 158, 11, 0.1)',
                color: 'rgb(217, 119, 6)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                textAlign: 'center',
                fontWeight: 500
              }}>
                📢 <strong>[Demo Mode]</strong><br />
                Email delivery may be delayed. Use code: <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary)', letterSpacing: '2px', marginLeft: '4px' }}>{fallbackOtp}</strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  style={{
                    width: '52px', height: '58px', textAlign: 'center',
                    fontSize: '1.5rem', fontWeight: 700,
                    border: `2px solid ${digit ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                    outline: 'none', transition: 'border-color 0.2s',
                  }}
                  disabled={loading}
                />
              ))}
            </div>

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading}>
              <ShieldCheck size={18} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
              {loading ? 'Verifying...' : 'Confirm & Sign In'}
            </button>

            <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Didn't receive it? </span>
              <button type="button" onClick={handleResend} style={{
                fontSize: 'var(--text-sm)', color: 'var(--color-primary)',
                fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer'
              }}>
                Resend Code
              </button>
            </div>

            <div style={{ marginTop: 'var(--space-3)', textAlign: 'center' }}>
              <button type="button" onClick={() => { setStep('identifier'); setError(''); setOtp(['','','','','','']); }}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Cancel & Return
              </button>
            </div>
          </form>
        )}

        <div className="auth-security-badge" style={{ marginTop: 'var(--space-6)' }}>
          <ShieldCheck size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
          Protected by TECHDEVS ✓ Security
        </div>
      </div>
      <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" />
    </div>
  );
}
