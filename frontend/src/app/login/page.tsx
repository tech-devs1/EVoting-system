'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { ShieldCheck, Mail, Lock, KeyRound, CheckCircle2, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const { login, verifyOtp } = useAuth();

  // Step 1: credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: OTP
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const role = email.includes('admin') ? 'admin' : 'voter';
      const result = await login(email, password, role);
      if (result?.otpRequired && result.email) {
        setOtpEmail(result.email);
        setStep('otp');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
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
    if (otpCode.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
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

  return (
    <div className="auth-container animate-page-enter">
      <div className="auth-mesh"></div>
      
      <div className="glass-card-strong auth-card" style={{ maxWidth: '450px', width: '100%', margin: '0 auto' }}>
        <div className="auth-header">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>
              <ArrowLeft size={14} /> Back to Home
            </Link>
          </div>
          <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldCheck size={28} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>
              Votick <span style={{ color: 'var(--color-primary)' }}>✓</span>
            </span>
          </div>
          <h2 className="auth-title" style={{ marginTop: 'var(--space-4)' }}>
            {step === 'credentials' ? 'Voter & Admin Portal' : 'Verify Your Identity'}
          </h2>
          <p className="auth-subtitle">
            {step === 'credentials'
              ? 'Sign in to review credentials and submit your ballot.'
              : `Enter the 6-digit code sent to ${otpEmail}`}
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

        {step === 'credentials' && (
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <label className="form-checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" className="form-checkbox" defaultChecked />
                <span style={{ fontSize: 'var(--text-sm)' }}>Remember this session</span>
              </label>
              <Link href="/forgot-password" style={{ fontSize: 'var(--text-sm)' }}>Forgot Key?</Link>
            </div>

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading}>
              <KeyRound size={18} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
          </form>
        )}

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
                Check your inbox — code expires in <strong>10 minutes</strong>
              </p>
            </div>

            {/* 6-digit OTP boxes */}
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
                    width: '52px', height: '58px',
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    border: `2px solid ${digit ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color 0.2s',
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
              <button type="button" onClick={() => { setStep('credentials'); setError(''); setOtp(['','','','','','']); }}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}

        {step === 'credentials' && (
          <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Don't have an account? </span>
            <Link href="/register" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', fontWeight: 'bold' }}>
              Register Account
            </Link>
          </div>
        )}

        <div className="auth-security-badge" style={{ marginTop: 'var(--space-6)' }}>
          <ShieldCheck size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
          Protected by Votick ✓ Security
        </div>
      </div>
    </div>
  );
}
