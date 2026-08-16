'use client';

import React from 'react';
import Skeleton from './Skeleton';

/**
 * Branded full-screen loading state shown while the auth session restores.
 * Clean, dependency-free (no framer-motion — iOS-safe) and matches the
 * app's solid-color design language.
 */
export default function AppLoading({ label = 'Loading HTU Elect…' }: { label?: string }) {
  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-slate-950"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center overflow-hidden">
          <img
            src="/assets/logo.png"
            alt="HTU Elect Logo"
            className="w-14 h-14 object-contain"
          />
        </div>
        <div className="text-center">
          <div className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            HTU Elect <span className="text-blue-600 dark:text-blue-500">✓</span>
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
            {label}
          </div>
        </div>
      </div>
      <div className="w-40 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
        <Skeleton className="h-full w-full rounded-full" />
      </div>
    </div>
  );
}
