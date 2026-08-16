'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { hardNavigate } from '@/lib/navigation';
import { KeyRound, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';

type ResetStep = 'request' | 'reset';

export default function ForgotPasswordPage() {

  const [step, setStep] = useState<ResetStep>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [fallbackCode, setFallbackCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setFallbackCode('');

    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; message?: string; fallbackCode?: string }>(
        '/auth/forgot-password',
        'POST',
        { email: email.trim() }
      );
      setMessage(res.message || 'If the email exists, a reset code was sent.');
      if (res.fallbackCode) setFallbackCode(res.fallbackCode);
      setStep('reset');
    } catch (err: any) {
      setError(err?.message || 'Failed to send the reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!code.trim() || !password) {
      setError('Reset code and new password are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; message?: string }>('/auth/reset-password', 'POST', {
        email: email.trim(),
        code: code.trim(),
        newPassword: password,
      });
      setMessage(res.message || 'Password reset successful.');
      setTimeout(() => hardNavigate('/login'), 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all';

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-6 py-12 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 md:p-10 shadow-lg shadow-slate-100 dark:shadow-none">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mb-5 shadow-sm">
            <KeyRound size={32} />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
            {step === 'request' ? 'Reset your password' : 'Enter reset code'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-normal max-w-xs mx-auto">
            {step === 'request'
              ? 'Enter your registered email and we will send you a one-time reset code.'
              : `We sent a reset code to ${email || 'your email'}.`}
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-xs bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 font-semibold mb-6 animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </div>
        )}

        {message && (
          <div className="p-4 rounded-xl text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 font-semibold mb-6">
            {message}
          </div>
        )}

        {fallbackCode && (
          <div className="p-4 rounded-xl text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 mb-6">
            Email/SMS delivery is unavailable right now — your reset code is:{' '}
            <strong className="tracking-widest">{fallbackCode}</strong>
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={requestReset} className="flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@htu.edu.gh"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white rounded-2xl font-semibold text-sm cursor-pointer disabled:cursor-not-allowed transition-all duration-150 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.99]"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="flex flex-col gap-5">
            <div>
              <label htmlFor="code" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Reset Code
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters, 1 uppercase, 1 number, 1 symbol"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white rounded-2xl font-semibold text-sm cursor-pointer disabled:cursor-not-allowed transition-all duration-150 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.99]"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <button
              type="button"
              onClick={() => setStep('request')}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium cursor-pointer transition-colors"
            >
              ← Didn&apos;t get a code? Request again
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-8 flex items-center justify-center gap-1.5">
          <ShieldCheck size={12} className="text-blue-500" />
          Remembered your password?{' '}
          <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
