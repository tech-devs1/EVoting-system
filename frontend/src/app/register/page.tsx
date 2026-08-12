'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-200 relative overflow-hidden">
      {/* Decorative radial mesh background */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-3xl -top-20 -left-20 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-3xl -bottom-20 -right-20 pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 md:p-10 shadow-lg text-center relative z-10">
        
        {/* Header Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mb-6 shadow-sm">
          <ShieldCheck size={36} />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
          Registration Streamlined
        </h2>

        {/* Message */}
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-8 max-w-sm mx-auto">
          Voter registration is no longer required. HTU Elect has transitioned exclusively to secure <strong className="text-slate-900 dark:text-white">Google Single Sign-On</strong>.
          <br /><br />
          You can log in directly using your official university or personal Google account.
        </p>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs cursor-pointer transition-all duration-150 shadow-md shadow-blue-500/10 active:scale-[0.99]"
        >
          <span>Proceed to Sign In</span>
          <ArrowRight size={16} />
        </button>

        {/* Footer info decoration */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-slate-400 dark:text-slate-500 text-[11px]">
          <Sparkles size={12} className="text-amber-500" />
          <span>No password configuration needed.</span>
        </div>

      </div>
    </div>
  );
}
