'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldCheck, 
  Hash, 
  ArrowRight, 
  User, 
  Mail, 
  Lock, 
  MailCheck, 
  Check 
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

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError('Student ID is required');
      return;
    }
    setError('');
    setCurrentStep(2);
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
    if (password !== confirmPassword) {
      setError('Passphrases do not match');
      return;
    }
    setLoading(true);
    try {
      // Registers user in backend and issues token securely
      await register(studentId, email, name, password);
      setCurrentStep(4);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
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
              VoteTrust <strong style={{ color: 'var(--color-primary)' }}>AI</strong>
            </span>
          </div>
          <h2 className="auth-title" style={{ marginTop: 'var(--space-4)' }}>Voter Registration</h2>
          <p className="auth-subtitle">Verify your student profile to claim voter verification certificates.</p>
        </div>

        <div className="reg-progress" style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: 'var(--space-6)', alignItems: 'center' }}>
          <div 
            className="reg-progress-bar" 
            style={{ 
              width: `${((currentStep - 1) / 3) * 100}%`,
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
              <button type="submit" className="btn btn-primary btn-full hover-lift" style={{ marginTop: 'var(--space-4)' }}>
                Verify Student Record <ArrowRight size={18} style={{ marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
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
                    placeholder="alex.mercer@htu.edu" 
                    required 
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
            <div className="success-screen" style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
              <div className="success-icon-wrapper" style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                background: 'var(--color-success-bg)', 
                color: 'var(--color-success)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto var(--space-4) auto' 
              }}>
                <MailCheck size={32} />
              </div>
              <h3 className="auth-title">Registration Verified</h3>
              <p className="auth-subtitle" style={{ marginBottom: 'var(--space-6)' }}>
                An email verification challenge was sent. Tap the confirmation link in your institutional inbox to activate key verification.
              </p>
              <Link href="/login" className="btn btn-primary btn-full hover-lift">Proceed to Login Terminal</Link>
            </div>
          )}
        </div>

        <div className="auth-security-badge" style={{ marginTop: 'var(--space-6)' }}>
          <ShieldCheck size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> 
          Protected by VoteTrust AI Security
        </div>
      </div>
    </div>
  );
}
