'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Vote,
  CheckCircle2,
  ArrowRight,
  Lock,
  Users,
  Award,
  Sparkles,
  BarChart3,
  UserCheck,
  Mail,
  Eye,
  Fingerprint,
  Clock
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] text-slate-900 dark:text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white transition-colors duration-200">

      {/* Header / Navigation */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-50 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 p-1.5 flex items-center justify-center shadow-sm border border-slate-200/80 dark:border-slate-800">
            <img src="/assets/logo.png" alt="HTU Elect Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl text-slate-900 dark:text-white tracking-tight leading-none">
              HTU Elect
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">
              Ho Technical University
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-6 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-full shadow-sm transition-all active:scale-95"
          >
            Register
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 pt-10 pb-14 flex-1 flex flex-col justify-center items-center text-center relative">

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight max-w-4xl leading-[1.1] mb-4">
          A secure place to cast your vote.
        </h1>

        {/* Card Deck with Images */}
        <div className="relative w-full max-w-4xl my-8 py-4 flex items-center justify-center overflow-visible">

          {/* Floating Tags */}
          <div className="absolute top-0 left-[8%] md:left-[18%] z-30 px-4 py-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold shadow-lg shadow-blue-600/20 flex items-center gap-1.5 -rotate-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>@SRC Election</span>
          </div>

          <div className="absolute top-2 right-[8%] md:right-[18%] z-30 px-4 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 rotate-6">
            <UserCheck className="w-3.5 h-3.5" />
            <span>@Department Polls</span>
          </div>

          {/* Cards Container */}
          <div className="flex items-center justify-center -space-x-6 md:-space-x-8 py-4">

            {/* Card 1 */}
            <div className="w-32 h-44 md:w-44 md:h-60 rounded-2xl md:rounded-3xl overflow-hidden shadow-lg transform -rotate-12 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 dark:border-slate-800/60">
              <div className="absolute inset-0 w-full h-full bg-[#DBEAFE] dark:bg-slate-800">
                <img src="/assets/school.jpg" alt="Ballot Art 1" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 p-4 flex flex-col justify-end">
                <p className="text-[10px] font-bold text-white uppercase tracking-wide bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full w-fit">
                  SRC Executive
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="w-32 h-44 md:w-44 md:h-60 rounded-2xl md:rounded-3xl overflow-hidden shadow-lg transform -rotate-6 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 dark:border-slate-800/60">
              <div className="absolute inset-0 w-full h-full bg-[#E0E7FF] dark:bg-slate-800">
                <img src="/assets/images1.jpeg" alt="Ballot Art 2" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="absolute inset-0 bg-blue-900/40 dark:bg-blue-900/60 p-4 flex flex-col justify-end">
                <p className="text-[10px] font-bold text-white uppercase tracking-wide bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full w-fit">
                  Faculty Election
                </p>
              </div>
            </div>

            {/* Card 3 (Center) */}
            <div className="w-36 h-48 md:w-52 md:h-68 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl z-20 border border-slate-300/70 dark:border-slate-700/70 transform hover:scale-105 transition-all duration-300 flex flex-col justify-end shrink-0 relative group">
              <div className="absolute inset-0 w-full h-full bg-[#F1F5F9] dark:bg-slate-800">
                <img src="/assets/images2.jpeg" alt="Ballot Art 3" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-900/70 p-5 flex flex-col justify-end">
                <p className="text-[10px] font-bold text-white uppercase tracking-wide bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full w-fit">
                  Presidential & Local
                </p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="w-32 h-44 md:w-44 md:h-60 rounded-2xl md:rounded-3xl overflow-hidden shadow-lg transform rotate-6 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 dark:border-slate-800/60">
              <div className="absolute inset-0 w-full h-full bg-[#FEF3C7] dark:bg-slate-800">
                <img src="/assets/images3.jpeg" alt="Ballot Art 4" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="absolute inset-0 bg-amber-900/40 dark:bg-amber-900/60 p-4 flex flex-col justify-end">
                <p className="text-[10px] font-bold text-white uppercase tracking-wide bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full w-fit">
                  Hall Residence
                </p>
              </div>
            </div>

            {/* Card 5 */}
            <div className="w-32 h-44 md:w-44 md:h-60 rounded-2xl md:rounded-3xl overflow-hidden shadow-lg transform rotate-12 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 dark:border-slate-800/60">
              <div className="absolute inset-0 w-full h-full bg-[#D1FAE5] dark:bg-slate-800">
                <img src="/assets/images4.jpeg" alt="Ballot Art 5" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="absolute inset-0 bg-emerald-900/40 dark:bg-emerald-900/60 p-4 flex flex-col justify-end">
                <p className="text-[10px] font-bold text-white uppercase tracking-wide bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full w-fit">
                  Department Reps
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto mt-1 mb-8 leading-relaxed font-medium">
          Students and voters can securely cast their ballots, explore live election turnout, and verify transparent cryptographic results with total peace of mind.
        </p>

        {/* Primary Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-full font-bold text-xs shadow-xl shadow-slate-900/10 dark:shadow-none flex items-center gap-2.5 transition-all active:scale-95"
          >
            <span>Cast Your Vote</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/register"
            className="px-6 py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-full font-bold text-xs shadow-sm transition-all active:scale-95"
          >
            Register Account
          </Link>
        </div>

      </main>


      {/* Footer */}
      <footer className="w-full border-t border-slate-200/60 dark:border-slate-800/60 py-8 px-6 text-center text-sm text-slate-400 font-medium">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} HTU Elect — Ho Technical University Electronic Voting System.</p>
        </div>
      </footer>

    </div>
  );
}