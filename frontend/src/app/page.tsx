import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Vote, CheckCircle2, ArrowRight, Lock, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white flex flex-col justify-between transition-colors duration-200">

      {/* Top Navigation */}
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 flex items-center justify-center shadow-sm">
              <img src="/assets/logo.png" alt="HTU Elect Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight block leading-tight">
                HTU Elect
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Ho Technical University
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content / Hero */}
      <main className="max-w-5xl mx-auto px-6 py-16 md:py-24 flex-1 flex flex-col justify-center items-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-6">
          <ShieldCheck className="w-4 h-4" />
          <span>Official HTU E-Voting Portal</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight max-w-3xl leading-tight md:leading-tight mb-6">
          Secure, Transparent & Instant Electronic Voting
        </h1>

        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Welcome to HTU Elect, the modern digital balloting platform for Ho Technical University elections. Cast your vote securely from any device with end-to-end verification and real-time result aggregation.
        </p>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-xs sm:max-w-md justify-center mb-16">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Vote className="w-4 h-4" />
            <span>Cast Your Vote</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <span>Register Account</span>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          <div className="p-6 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Encrypted Ballots</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Every vote is cryptographically secured to guarantee voter anonymity and tamper-proof election integrity.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Verified Roster</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Roster identity verification ensures eligible voters cast exactly one ballot per election.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Real-Time Turnout</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Track live voter turnout progress and instant certified results as soon as voting closes.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 py-6 px-6 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} HTU Elect — Ho Technical University Electronic Voting System.</p>
      </footer>
    </div>
  );
}
