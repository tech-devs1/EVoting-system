'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { 
  ShieldCheck, 
  Hash, 
  ArrowRight, 
  User, 
  Mail, 
  Lock, 
  MailCheck, 
  Check,
  CheckCircle2
} from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState('');

  // Countdown effect for resend button
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError('Student ID is required');
      return;
    }
    setError('');
    setInfoMessage('');
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; data: { name: string; email: string }; message?: string }>('/auth/verify-student', 'POST', { studentId });
      if (res.status === 'success') {
        setName(res.data.name);
        setEmail(res.data.email);
        setCurrentStep(2);
      } else if (res.status === 'incomplete_registration') {
        // User has incomplete registration - redirect to OTP verification
        setName(res.data.name);
        setEmail(res.data.email);
        setOtpEmail(res.data.email);
        setInfoMessage(res.message || 'You have an incomplete registration. Please complete the verification process.');
        setCurrentStep(4); // Skip to OTP verification step
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify student ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      setError('Name and Email are required');
      return;
    }
    setError('');
    setCurrentStep(3);
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Password validation: minimum 8 chars, 1 uppercase, 1 lowercase, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passphrases do not match');
      return;
    }
    setLoading(true);
    try {
      const result = await register(studentId, email, name, password);
      if (result?.otpRequired && result.email) {
        setOtpEmail(result.email);
        setCurrentStep(4); // OTP verification step
      } else {
        setCurrentStep(5); // success
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

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

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) { setError('Please enter the full 6-digit code.'); return; }
    setError('');
    setInfoMessage('');
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; token: string; data: any }>('/auth/verify-otp', 'POST', { email: otpEmail, otp: otpCode });
      if (res.status === 'success') {
        setCurrentStep(5); // success screen
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    try {
      await apiRequest('/auth/resend-otp', 'POST', { email: otpEmail });
      setResendMsg('A new code has been sent to your email.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      // start 60‑second cooldown
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend.');
    }
  };
  const renderStepNumber = (step: number) => {
    if (currentStep > step) {
      return (
        <div className="reg-step completed" key={step}>
          <Check size={14} />
        </div>
      );
    }
    return (
      <div className={`reg-step ${currentStep === step ? 'active' : ''}`} key={step}>
        {step}
      </div>
    );
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
          <h2 className="auth-title" style={{ marginTop: 'var(--space-4)' }}>Voter Registration</h2>
          <p className="auth-subtitle">Verify your student profile to claim voter verification certificates.</p>
        </div>

        <div className="reg-progress" style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: 'var(--space-6)', alignItems: 'center' }}>
          <div 
            className="reg-progress-bar" 
            style={{ 
              width: `${((currentStep - 1) / 4) * 100}%`,
              height: '2px',
              background: 'var(--color-primary)',
              position: 'absolute',
              top: '50%',
              left: 0,
              zIndex: 1,
              transition: 'width var(--transition-base)'
            }}
          ></div>
          {renderStepNumber(1)}
          {renderStepNumber(2)}
          {renderStepNumber(3)}
          {renderStepNumber(4)}
          {renderStepNumber(5)}
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

        {infoMessage && (
          <div className="alert alert-info" style={{ 
            padding: 'var(--space-3) var(--space-4)', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
            background: 'var(--color-primary-100)',
            color: 'var(--color-primary)',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            {infoMessage}
          </div>
        )}

        <div id="register-card-body">
          {currentStep === 1 && (
            <form onSubmit={handleStep1Submit}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-id">Student ID / Employee Code</label>
                <div className="form-input-container">
                  <Hash size={18} className="form-input-icon" />
                  <input 
                    type="text" 
                    id="reg-id" 
                    className="form-input form-input-with-icon" 
                    placeholder="HTU-2026-8849" 
                    required 
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading} style={{ marginTop: 'var(--space-4)' }}>
                {loading ? 'Verifying...' : 'Verify Student Record'} <ArrowRight size={18} style={{ marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
              </button>
            </form>
          )}

          {currentStep === 2 && (
            <form onSubmit={handleStep2Submit}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name (Matches ID)</label>
                <div className="form-input-container">
                  <User size={18} className="form-input-icon" />
                  <input 
                    type="text" 
                    id="reg-name" 
                    className="form-input form-input-with-icon" 
                    placeholder="Alex Mercer" 
                    required 
                    readOnly
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">Institution Email Address</label>
                <div className="form-input-container">
                  <Mail size={18} className="form-input-icon" />
                  <input 
                    type="email" 
                    id="reg-email" 
                    className="form-input form-input-with-icon" 
                    placeholder="id@htu.edu.gh" 
                    required 
                    readOnly
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-secondary btn-full" onClick={() => setCurrentStep(1)}>Back</button>
                <button type="submit" className="btn btn-primary btn-full">Continue</button>
              </div>
            </form>
          )}

          {currentStep === 3 && (
            <form onSubmit={handleStep3Submit}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Ballot Security Passphrase</label>
                <div className="form-input-container">
                  <Lock size={18} className="form-input-icon" />
                  <input 
                    type="password" 
                    id="reg-password" 
                    className="form-input form-input-with-icon" 
                    placeholder="••••••••••••" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">Confirm Passphrase</label>
                <div className="form-input-container">
                  <Lock size={18} className="form-input-icon" />
                  <input 
                    type="password" 
                    id="reg-confirm" 
                    className="form-input form-input-with-icon" 
                    placeholder="••••••••••••" 
                    required 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-secondary btn-full" onClick={() => setCurrentStep(2)} disabled={loading}>Back</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Registering...' : 'Register'}
                </button>
              </div>
            </form>
          )}

          {currentStep === 4 && (
            <form onSubmit={handleOtpSubmit}>
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: 'var(--color-primary-100)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto var(--space-3) auto'
                }}>
                  <CheckCircle2 size={30} style={{ color: 'var(--color-primary)' }} />
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  A 6-digit code was sent to <strong>{otpEmail}</strong>.<br />Enter it below to verify your account.
                </p>
              </div>

              {resendMsg && (
                <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                  {resendMsg}
                </div>
              )}

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
                      width: '48px', height: '54px',
                      textAlign: 'center',
                      fontSize: '1.4rem',
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
                {loading ? 'Verifying...' : 'Verify & Complete Registration'}
              </button>

              <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Didn't get the code? </span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || resendCooldown > 0}
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--color-primary)',
                    fontWeight: 'bold',
                    background: 'none',
                    border: 'none',
                    cursor: resendCooldown > 0 ? 'default' : 'pointer'
                  }}
                >
                  {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {currentStep === 5 && (
            <div className="success-screen" style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
              <div className="success-icon-wrapper" style={{ 
                width: '64px', height: '64px', borderRadius: '50%', 
                background: 'var(--color-success-bg)', color: 'var(--color-success)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                margin: '0 auto var(--space-4) auto' 
              }}>
                <MailCheck size={32} />
              </div>
              <h3 className="auth-title">Account Verified & Created!</h3>
              <p className="auth-subtitle" style={{ marginBottom: 'var(--space-6)' }}>
                Your identity has been confirmed. Please proceed to the login terminal to authenticate with your new passphrase.
              </p>
              <Link href="/login" className="btn btn-primary btn-full hover-lift">Proceed to Login Terminal</Link>
            </div>
          )}
        </div>

        <div className="auth-security-badge" style={{ marginTop: 'var(--space-6)' }}>
          <ShieldCheck size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> 
          Protected by Votick ✓ Security
        </div>
      </div>
    </div>
  );
}
