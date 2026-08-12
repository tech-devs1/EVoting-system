'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await loginWithGoogle(idToken);
    } catch (err: any) {
      console.error('Google login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelled. Please select your Google account in the popup.');
      } else {
        setError(err.message || 'Google Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-6 py-12 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 md:p-10 shadow-lg shadow-slate-100 dark:shadow-none">

        {/* Header Logo & Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 mb-5 shadow-sm overflow-hidden">
            <img src="/assets/logo.png" alt="HTU Elect Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
            HTU Elect
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-normal max-w-xs mx-auto">
            Ho Technical University Electronic Voting Portal
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-xs bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 font-semibold mb-6 animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-col gap-6">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white rounded-2xl font-semibold text-sm cursor-pointer disabled:cursor-not-allowed transition-all duration-150 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.99]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" className="brightness-0 invert">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.13C3.25 21.3 7.31 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.4l4.01-3.13z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4.01 3.13c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span>{loading ? 'Authenticating...' : 'Sign In with Google'}</span>
          </button>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center leading-relaxed max-w-xs mx-auto">
            Unified login portal for voters, department executives, and system administrators via secure Google Authentication.
          </p>
        </div>

      </div>
    </div>
  );
}
