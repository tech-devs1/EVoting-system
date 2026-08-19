'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  UserPlus,
  Hash,
  BadgeCheck,
  KeyRound,
  PartyPopper,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

const STEPS = [
  { label: 'Verify Identity', icon: Hash },
  { label: 'Your Details', icon: BadgeCheck },
  { label: 'Set Password', icon: KeyRound },
  { label: 'All Done', icon: PartyPopper },
];

export default function RegisterPage() {
  const { register, verifyOtp } = useAuth();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);

  // Form data
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');

  // OTP
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');

  // Extra roster fields
  const [program, setProgram] = useState('');
  const [level, setLevel] = useState('');

  // ── Step 1: Verify Identity ─────────────────────────────────────────────
  const handleVerifyStudent = async () => {
    if (!studentId.trim()) return;
    setVerifying(true);
    setVerifyMsg('');
    setVerified(false);
    setError('');
    try {
      const res = await apiRequest<any>('/auth/verify-student', 'POST', { studentId: studentId.trim() });
      if (res.status === 'success' && res.data) {
        if (res.data.name || res.data.email) {
          if (res.data.name) setName(res.data.name);
          if (res.data.email) setEmail(res.data.email);
          if (res.data.phone) setPhone(res.data.phone);
          if (res.data.program) setProgram(res.data.program);
          if (res.data.level) setLevel(res.data.level);
          setVerified(true);
        } else {
          setError('Your index number was not found on the official voter roster. Please contact your election administrator to be added before registering.');
        }
      } else {
        setError(res.message || 'This student ID has already been registered.');
      }
    } catch (err: any) {
      setError(err.message || 'Student not found on roster. Please contact your administrator.');
    } finally {
      setVerifying(false);
    }
  };

  // ── Step 3: Register ────────────────────────────────────────────────────
  const handleRegister = async () => {
    setError('');
    if (!verified || !studentId.trim() || !email.trim() || !password) {
      setError('All fields are required.');
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
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError('Password must contain uppercase, lowercase, and a special character.');
      return;
    }

    setLoading(true);
    try {
      const res = await register(
        studentId.trim(),
        email.trim(),
        name.trim() || email.trim().split('@')[0],
        password,
        phone.trim() || undefined
      );
      if (res.otpRequired) {
        setOtpStep(true);
      } else {
        setCurrentStep(3);
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Verification ────────────────────────────────────────────────────
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
      setCurrentStep(3);
      setSuccess(true);
      setOtpStep(false);
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const canProceedFromStep1 = verified;
  const canProceedFromStep2 = true;
  const inputClass =
    'w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Back to Login */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-5 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Sign In
        </Link>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 text-center border-b border-slate-100 dark:border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/25">
              <UserPlus size={22} className="text-white" />
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Create your account
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Only rostered voters at HTU can register
            </p>
          </div>

          {/* Step Indicator */}
          {!otpStep && (
            <div className="px-6 pt-5 pb-2">
              <div className="flex items-center justify-between">
                {STEPS.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isActive = idx === currentStep;
                  const isDone = idx < currentStep || (idx === 3 && success);
                  return (
                    <React.Fragment key={idx}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                            isDone
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                              : isActive
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-4 ring-blue-100 dark:ring-blue-900/40'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {isDone ? <CheckCircle2 size={16} /> : <StepIcon size={16} />}
                        </div>
                        <span
                          className={`text-[10px] font-bold tracking-wide ${
                            isActive
                              ? 'text-blue-600 dark:text-blue-400'
                              : isDone
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-2 rounded-full transition-all duration-500 ${
                            idx < currentStep || (idx === 2 && success)
                              ? 'bg-emerald-400'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* ── Step 0: Verify Identity ──────────────────────────────── */}
          {currentStep === 0 && !otpStep && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                  Enter your Index / Staff ID
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  We'll look up your details from the official voter roster.
                </p>
              </div>

              <div className="relative mb-3">
                <Hash
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    setVerified(false);
                    setVerifyMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && studentId.trim().length >= 3 && !verifying) {
                      handleVerifyStudent();
                    }
                  }}
                  placeholder="e.g. 0325080551"
                  className={inputClass}
                  autoFocus
                />
              </div>

              {/* Verify Button */}
              <button
                type="button"
                onClick={handleVerifyStudent}
                disabled={!studentId.trim() || verifying || studentId.trim().length < 3}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white dark:text-slate-400 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:shadow-none"
              >
                {verifying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    Verify Identity <ChevronRight size={16} />
                  </>
                )}
              </button>

              {/* Verified message */}
              {verified && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/30">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Identity Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    Your index number is on the official roster. Tap "Next" to continue.
                  </p>
                </div>
              )}

              {/* Next button (only when verified) */}
              {verified && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="w-full mt-3 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
                >
                  Next <ChevronRight size={16} />
                </button>
              )}

              <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-4">
                Use your official <strong>@htu.edu.gh</strong> student email. Other domains are not allowed.
              </p>
            </div>
          )}

          {/* ── Step 1: Voter Details ──────────────────────────────── */}
          {currentStep === 1 && !otpStep && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                  Confirm your details
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Please verify these details are correct before proceeding.
                </p>
              </div>

              {/* Detail cards */}
              <div className="space-y-3">
                <DetailRow icon={<Hash size={16} />} label="Index Number" value={studentId} />
                <DetailRow icon={<User size={16} />} label="Full Name" value={name || '—'} />
                <DetailRow icon={<Mail size={16} />} label="Email Address" value={email || '—'} />
                {phone && <DetailRow icon={<span className="text-sm">📱</span>} label="Phone" value={phone} />}
                {program && <DetailRow icon={<span className="text-sm">📚</span>} label="Program" value={program} />}
                {level && <DetailRow icon={<span className="text-sm">🎓</span>} label="Level" value={level} />}
              </div>

              {/* Navigation */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setCurrentStep(0)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex-[2] py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Create Password ────────────────────────────── */}
          {currentStep === 2 && !otpStep && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                  Create your password
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Set a strong password to secure your account.
                </p>
              </div>

              <div className="space-y-3">
                {/* Password */}
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className={inputClass}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Confirm Password */}
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className={inputClass}
                  />
                </div>

                {/* Password rules */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Password Requirements
                  </p>
                  <div className="space-y-1.5">
                    <PasswordRule met={password.length >= 8} text="At least 8 characters" />
                    <PasswordRule met={/[A-Z]/.test(password)} text="One uppercase letter" />
                    <PasswordRule met={/[a-z]/.test(password)} text="One lowercase letter" />
                    <PasswordRule met={/[^A-Za-z0-9]/.test(password)} text="One special character" />
                    <PasswordRule met={password === confirmPassword && confirmPassword.length > 0} text="Passwords match" />
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={loading || !password || !confirmPassword}
                  className="flex-[2] py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white dark:text-slate-400 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:shadow-none"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Creating Account…
                    </>
                  ) : (
                    <>
                      Create Account <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── OTP Verification (shown when backend requires it) ── */}
          {otpStep && (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                  Verify your email
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter the 6-digit code sent to <strong>{email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-center text-lg font-mono font-bold tracking-[0.3em] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !otp.trim()}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white dark:text-slate-400 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:shadow-none"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Verifying…
                    </>
                  ) : (
                    'Verify & Complete'
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setOtpStep(false);
                  setCurrentStep(2);
                  setOtp('');
                  setError('');
                }}
                className="w-full mt-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-700 dark:hover:text-slate-300 transition-colors text-center"
              >
                ← Back to password
              </button>
            </div>
          )}

          {/* ── Step 3: All Done ────────────────────────────────────── */}
          {currentStep === 3 && success && (
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">
                You're all set! 🎉
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
                Your account has been created{otpStep ? ' and verified' : ''}. You can now sign in to participate in elections.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-500/20"
              >
                Sign In to Vote <ChevronRight size={16} />
              </Link>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
      <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {label}
        </div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

function PasswordRule({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
          met
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
        }`}
      >
        {met && <CheckCircle2 size={10} />}
      </div>
      <span
        className={`text-[11px] font-medium ${
          met
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {text}
      </span>
    </div>
  );
}
