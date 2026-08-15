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
  UserCheck
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F4F4F6] dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col justify-between selection:bg-blue-500 selection:text-white transition-colors duration-300">

      {/* Top Header / Navigation */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 p-1.5 flex items-center justify-center shadow-sm border border-slate-200/80 dark:border-slate-800">
            <img src="/assets/logo.png" alt="HTU Elect Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-lg text-slate-900 dark:text-white tracking-tight leading-none">
              HTU Elect
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">
              Ho Technical University
            </span>
          </div>
        </div>

        {/* Center Nav links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Link href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Features
          </Link>
          <Link href="#elections" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Elections
          </Link>
          <Link href="#security" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Security
          </Link>
          <Link href="/voter/verify" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Audit Ledger
          </Link>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-full shadow-sm transition-all active:scale-95"
          >
            Register
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 pt-8 pb-16 flex-1 flex flex-col justify-center items-center text-center relative">

        {/* Sub-badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm text-slate-800 dark:text-slate-200 text-xs font-semibold mb-8 animate-fade-in">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Next-Gen E-Voting Platform for HTU</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight max-w-4xl leading-[1.1] mb-6">
          A secure place to cast your vote.
        </h1>

        {/* Card Stack / Floating Artwork Deck with Images Inspired by Design */}
        <div className="relative w-full max-w-4xl my-8 py-6 flex items-center justify-center overflow-visible">

          {/* Floating Tag 1 */}
          <div className="absolute top-0 left-[12%] md:left-[20%] z-30 px-3.5 py-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold shadow-lg shadow-blue-500/30 flex items-center gap-1.5 -rotate-6 animate-bounce-slow">
            <Sparkles className="w-3.5 h-3.5" />
            <span>@SRC Election</span>
          </div>

          {/* Floating Tag 2 */}
          <div className="absolute top-2 right-[12%] md:right-[20%] z-30 px-3.5 py-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold shadow-lg shadow-emerald-500/30 flex items-center gap-1.5 rotate-6">
            <UserCheck className="w-3.5 h-3.5" />
            <span>@Department Polls</span>
          </div>

          {/* Deck Cards Container */}
          <div className="flex items-center justify-center -space-x-8 md:-space-x-10 py-4">

            {/* Card 1 */}
            <div className="w-36 h-48 md:w-48 md:h-64 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl transform -rotate-12 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-between shrink-0 relative group">
              <img src="/images/login_hero.jpg" alt="Ballot Art 1" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent p-4 flex flex-col justify-between text-white">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black/40 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-full">
                    Verified
                  </span>
                  <Lock className="w-4 h-4 text-white/90" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">SRC Executive</p>
                  <p className="text-sm md:text-base font-black mt-0.5 leading-snug">2025 General Ballot</p>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="w-36 h-48 md:w-48 md:h-64 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl transform -rotate-6 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-between shrink-0 relative group">
              <img src="/compssa_logo.png" alt="Ballot Art 2" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-950/90 via-blue-950/40 to-transparent p-4 flex flex-col justify-between text-white">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black/40 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-full">
                    Live
                  </span>
                  <Vote className="w-4 h-4 text-white/90" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wide">Faculty of Eng.</p>
                  <p className="text-sm md:text-base font-black mt-0.5 leading-snug">Dean & Rep Poll</p>
                </div>
              </div>
            </div>

            {/* Card 3 (Center Prominent Card) */}
            <div className="w-40 h-52 md:w-52 md:h-72 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl z-20 border border-slate-700/50 transform hover:scale-105 transition-all duration-300 flex flex-col justify-between shrink-0 relative group">
              <img src="/htu_logo.png" alt="Ballot Art 3" className="absolute inset-0 w-full h-full object-contain bg-slate-900 p-4 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-950/20 p-5 flex flex-col justify-between text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 bg-blue-500/30 text-blue-300 px-2.5 py-1 rounded-full border border-blue-400/40 text-[10px] font-bold backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    Active Election
                  </div>
                  <Award className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">HTU ELECT</span>
                  <h3 className="text-base md:text-xl font-black mt-0.5 leading-snug">
                    Presidential & Local Elections
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">End-to-End Encrypted & Audited</p>
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="w-36 h-48 md:w-48 md:h-64 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl transform rotate-6 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-between shrink-0 relative group">
              <img src="/assets/logo.png" alt="Ballot Art 4" className="absolute inset-0 w-full h-full object-contain bg-amber-950/80 p-3 group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-amber-950/95 via-amber-950/40 to-transparent p-4 flex flex-col justify-between text-white">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black/40 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-full">
                    Hall Polls
                  </span>
                  <BarChart3 className="w-4 h-4 text-white/90" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold text-amber-200 uppercase tracking-wide">Hall Residence</p>
                  <p className="text-sm md:text-base font-black mt-0.5 leading-snug">Executives 2025</p>
                </div>
              </div>
            </div>

            {/* Card 5 */}
            <div className="w-36 h-48 md:w-48 md:h-64 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl transform rotate-12 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-between shrink-0 relative group">
              <img src="/images/login_hero.jpg" alt="Ballot Art 5" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/95 via-emerald-950/40 to-transparent p-4 flex flex-col justify-between text-white">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black/40 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-full">
                    Realtime
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-white/90" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wide">Department Reps</p>
                  <p className="text-sm md:text-base font-black mt-0.5 leading-snug">Instant Turnout</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Subtitle description */}
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto mt-2 mb-8 leading-relaxed font-medium">
          Students and voters can securely cast their ballots, explore live election turnout, and verify transparent cryptographic results with total peace of mind.
        </p>

        {/* Primary Pill Actions (Matching Image Style) */}
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
            className="px-6 py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-full font-bold text-xs shadow-sm transition-all active:scale-95"
          >
            Register Account
          </Link>
        </div>

      </main>

      {/* Feature Section Grid */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16 w-full border-t border-slate-200/60 dark:border-slate-800/60">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">

          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Encrypted Ballots</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Every vote is cryptographically secured to guarantee voter anonymity and tamper-proof election integrity.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Verified Roster</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Roster identity verification ensures eligible voters cast exactly one ballot per election.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Real-Time Turnout</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Track live voter turnout progress and instant certified results as soon as voting closes.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/60 dark:border-slate-800/60 py-8 px-6 text-center text-xs text-slate-400 font-medium">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} HTU Elect — Ho Technical University Electronic Voting System.</p>
          <div className="flex items-center gap-6">
            <Link href="/voter/verify" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              Verify Audit Record
            </Link>
            <Link href="/login" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              Admin Portal
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
