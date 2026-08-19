'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { ShieldCheck, Mail, Lock, KeyRound, CheckCircle2, Eye, EyeOff, ArrowLeft, Hash, Building2, ArrowRight, User } from 'lucide-react';

import Script from 'next/script';

export default function LoginPage() {
  const { login, requestOtp, verifyOtp } = useAuth();

  // Portal toggle
  const [portal, setPortal] = useState<'voter' | 'admin'>('voter');

  // ── Voter flow state ──
  const [voterStep, setVoterStep] = useState<'index' | 'verified' | 'otp'>('index');
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [fallbackOtp, setFallbackOtp] = useState('');

  // ── Admin flow state ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── OTP state (shared) ──
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── General ──
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');

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

  // ── Voter: Verify Index Number ──
  const handleVerifyIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) { setError('Student Index Number is required'); return; }
    if (!selectedTenant) { setError('Please select a department'); return; }

    let formattedId = studentId.trim();
    if (!formattedId.startsWith('0') && /^\d+$/.test(formattedId)) {
      formattedId = '0' + formattedId;
      setStudentId(formattedId);
    }

    const studentIdRegex = /^[a-zA-Z0-9-]+$/;
    if (!studentIdRegex.test(formattedId)) {
      setError('Student ID contains invalid characters.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; data: { name: string; email: string }; message?: string }>('/auth/verify-student', 'POST', { studentId: formattedId });
      if (res.status === 'success') {
        setStudentName(res.data.name);
        setStudentEmail(res.data.email);
        setVoterStep('verified');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify student ID.');
    } finally {
      setLoading(false);
    }
  };

  // ── Voter: Send OTP via Email ──
  const handleSendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await requestOtp(studentId);
      if (result?.otpRequired && result.email) {
        setOtpEmail(result.email);
        setFallbackOtp(result.fallbackOtp || '');
        setVoterStep('otp');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Voter: Google Sign-In ──
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      // Use Google Identity Services if available, otherwise use mock
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: async (response: any) => {
            try {
              const result = await requestOtp(studentId, response.credential);
              if (result?.otpRequired && result.email) {
                setOtpEmail(result.email);
                setFallbackOtp(result.fallbackOtp || '');
                setVoterStep('otp');
              }
            } catch (err: any) {
              setError(err.message || 'Google Sign-In failed.');
            } finally {
              setLoading(false);
            }
          }
        });
        (window as any).google.accounts.id.prompt();
      } else {
        // Mock Google Sign-In for development/testing
        const result = await requestOtp(studentId, `MOCK_GOOGLE_${studentEmail}`);
        if (result?.otpRequired && result.email) {
          setOtpEmail(result.email);
          setFallbackOtp(result.fallbackOtp || '');
          setVoterStep('otp');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Handlers ──
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

  // ── Admin: Login ──
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    let formattedEmail = email.trim();
    const [localPart, domain] = formattedEmail.split('@');
    if (localPart && !localPart.startsWith('0') && /^\d+$/.test(localPart)) {
      formattedEmail = `0${localPart}@${domain || 'htu.edu.gh'}`;
      setEmail(formattedEmail);
    }
    setLoading(true);
    try {
      let role: 'voter' | 'admin' | 'superadmin' = 'admin';
      if (formattedEmail === 'supertech@admin.com') {
        role = 'superadmin';
      }
      const result = await login(formattedEmail, password, role);
      if (result?.otpRequired && result.email) {
        setOtpEmail(result.email);
        setFallbackOtp(result.fallbackOtp || '');
        setStep('otp');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
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

          {/* Portal Toggle */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '4px', marginTop: 'var(--space-4)' }}>
            <button
              onClick={() => { setPortal('voter'); setError(''); }}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 'var(--text-sm)', transition: 'all 0.2s',
                background: portal === 'voter' ? 'var(--color-primary)' : 'transparent',
                color: portal === 'voter' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              🗳️ Voter Portal
            </button>
            <button
              onClick={() => { setPortal('admin'); setError(''); }}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 'var(--text-sm)', transition: 'all 0.2s',
                background: portal === 'admin' ? 'var(--color-primary)' : 'transparent',
                color: portal === 'admin' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              🔐 Administrator
            </button>
          </div>

          <h2 className="auth-title" style={{ marginTop: 'var(--space-4)' }}>
            {portal === 'voter'
              ? (voterStep === 'otp' ? 'Verify Your Identity' : 'Voter Sign In')
              : (step === 'otp' ? 'Verify Your Identity' : 'Admin Sign In')}
          </h2>
          <p className="auth-subtitle">
            {portal === 'voter'
              ? (voterStep === 'index'
                ? 'Select your department and enter your student index number.'
                : voterStep === 'verified'
                ? 'Confirm your details and choose a sign-in method.'
                : `Enter the 6-digit code sent to ${otpEmail}`)
              : (step === 'credentials'
                ? 'Sign in with your administrator credentials.'
                : `Enter the 6-digit code sent to ${otpEmail}`)}
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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* VOTER PORTAL */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {portal === 'voter' && voterStep === 'index' && (
          <form onSubmit={handleVerifyIndex}>
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
              <label className="form-label" htmlFor="student-id">Student Index Number</label>
              <div className="form-input-container">
                <Hash size={18} className="form-input-icon" />
                <input
                  type="text"
                  id="student-id"
                  className="form-input form-input-with-icon"
                  placeholder="e.g. 0324080516"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
                * We will automatically prefix with 0 if missing.
              </p>
            </div>

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading} style={{ marginTop: 'var(--space-2)' }}>
              {loading ? 'Verifying...' : 'Verify Index Number'} <ArrowRight size={18} style={{ marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
            </button>
          </form>
        )}

        {portal === 'voter' && voterStep === 'verified' && (
          <div>
            {/* Display fetched student info */}
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

            {/* Option 1: Send OTP to Email */}
            <button
              onClick={handleSendOtp}
              className="btn btn-primary btn-full hover-lift"
              disabled={loading}
              style={{ marginBottom: 'var(--space-3)' }}
            >
              <Mail size={18} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
              {loading ? 'Sending...' : 'Send OTP Code to Email'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-2) 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            </div>

            {/* Option 2: Google Sign-In */}
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
              <button type="button" onClick={() => { setVoterStep('index'); setError(''); }}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Back to Index Number
              </button>
            </div>
          </div>
        )}

        {portal === 'voter' && voterStep === 'otp' && (
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
                Check your school email{otpEmail ? ` (${otpEmail})` : ''} — a 6-digit verification code has been sent. It expires in <strong>10 minutes</strong>.
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
              <button type="button" onClick={() => { setVoterStep('verified'); setError(''); setOtp(['','','','','','']); }}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Back to Sign-In Options
              </button>
            </div>
          </form>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ADMIN PORTAL */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {portal === 'admin' && step === 'credentials' && (
          <form onSubmit={handleAdminSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
              <Link href="/forgot-password" style={{ fontSize: 'var(--text-sm)' }}>Forgot Password?</Link>
            </div>

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading}>
              <KeyRound size={18} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
          </form>
        )}

        {portal === 'admin' && step === 'otp' && (
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
                Check your email{otpEmail ? ` (${otpEmail})` : ''} — a 6-digit verification code has been sent.
              </p>
            </div>

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
              <button type="button" onClick={() => { setStep('credentials'); setError(''); setOtp(['','','','','','']); }}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Back to Sign In
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
