'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Mail, KeyRound, ArrowLeft, Lock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; message: string }>('/auth/forgot-password', 'POST', { email });
      if (res.status === 'success') {
        setStep(2);
        setSuccess(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; message: string }>('/auth/reset-password', 'POST', { 
        email, 
        code, 
        newPassword 
      });
      if (res.status === 'success') {
        setStep(3);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please check your code.');
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
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold' }}>Votick ✓</span>
          </div>
          <h2 className="auth-title">Password Recovery</h2>
          <p className="auth-subtitle">Securely reset your terminal access key.</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && step === 2 && <div className="auth-error" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)', border: '1px solid rgba(34,197,94,0.3)' }}>{success}</div>}

        {step === 1 && (
          <form onSubmit={handleRequestCode}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">University Email</label>
              <div className="form-input-container">
                <Mail size={18} className="form-input-icon" />
                <input 
                  type="email" 
                  id="reset-email" 
                  className="form-input form-input-with-icon" 
                  placeholder="student@htu.edu.gh" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading} style={{ marginTop: 'var(--space-4)' }}>
              {loading ? 'Requesting...' : 'Send Reset Code'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-code">6-Digit Reset Code</label>
              <div className="form-input-container">
                <KeyRound size={18} className="form-input-icon" />
                <input 
                  type="text" 
                  id="reset-code" 
                  className="form-input form-input-with-icon" 
                  placeholder="123456" 
                  required 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="new-pass">New Passphrase</label>
              <div className="form-input-container">
                <Lock size={18} className="form-input-icon" />
                <input 
                  type="password" 
                  id="new-pass" 
                  className="form-input form-input-with-icon" 
                  placeholder="••••••••••••" 
                  required 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="confirm-pass">Confirm Passphrase</label>
              <div className="form-input-container">
                <Lock size={18} className="form-input-icon" />
                <input 
                  type="password" 
                  id="confirm-pass" 
                  className="form-input form-input-with-icon" 
                  placeholder="••••••••••••" 
                  required 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full hover-lift" disabled={loading} style={{ marginTop: 'var(--space-4)' }}>
              {loading ? 'Verifying...' : 'Reset Passphrase'}
            </button>
          </form>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
              <ShieldCheck size={32} />
            </div>
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Passphrase Reset Successful</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', fontSize: 'var(--text-sm)' }}>Your terminal access key has been securely updated.</p>
            <Link href="/login" className="btn btn-primary btn-full hover-lift">
              Return to Login
            </Link>
          </div>
        )}

        {step !== 3 && (
          <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
            <Link href="/login" style={{ fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
