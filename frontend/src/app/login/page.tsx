'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const { login, verifyOtp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // OTP verification step (used when the backend requires one)
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      // On success, AuthContext shows a brief "Signing you in" loading screen
      // and auto-redirects
      // to the role dashboard after a short pause (with a "Go now" link).
      if (res.otpRequired) {
        setOtpStep(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otp.trim()) {
      setError('Please enter the verification code sent to your email.');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(email.trim(), otp.trim());
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 sm:px-6 py-8 sm:py-12 transition-colors duration-200 relative">
      {/* Hard-navigating back link (reliable on iOS Safari / static exports) */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard navigation is intentional for static cPanel exports */}
      <a
        href="/"
        className="absolute top-5 left-5 sm:top-6 sm:left-6 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors touch-manipulation"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to home
      </a>
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 md:p-10 shadow-lg shadow-slate-100 dark:shadow-none">

        {/* Header Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 mb-5 shadow-sm overflow-hidden">
            <img src="/assets/logo.png" alt="HTU Elect Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
            {otpStep ? 'Verify your identity' : 'Welcome back'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-normal max-w-xs mx-auto">
            {otpStep
              ? `Enter the 6-digit verification code sent to ${email || 'your email'}.`
              : 'Ho Technical University Electronic Voting Portal'}
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-xs bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 font-semibold mb-6 animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </div>
        )}

        {otpStep ? (
          /* ── OTP Verification Step ─────────────────────────────── */
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
            <div>
              <label htmlFor="otp" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Verification Code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white rounded-2xl font-semibold text-sm cursor-pointer disabled:cursor-not-allowed transition-all duration-150 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.99]"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => setOtpStep(false)}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium cursor-pointer transition-colors"
            >
              ← Back to sign in
            </button>
          </form>
        ) : (
          /* ── Email & Password Form ─────────────────────────────── */
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  required
                />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1.5">
                Only <strong>@htu.edu.gh</strong> student emails are accepted for voter registration.
              </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white rounded-2xl font-semibold text-sm cursor-pointer disabled:cursor-not-allowed transition-all duration-150 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.99]"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-8">
          New voter?{' '}
          <Link href="/register" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
