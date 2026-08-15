'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  UserCheck,
  Menu,
  X
} from 'lucide-react';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] text-slate-900 dark:text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white transition-colors duration-200">

      {/* Header / Navigation */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between z-50 border-b border-slate-200/60 dark:border-slate-800/60 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white dark:bg-slate-900 p-1.5 flex items-center justify-center shadow-sm border border-slate-200/80 dark:border-slate-800">
            <img src="/assets/logo.png" alt="HTU Elect Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight leading-none">
              HTU Elect
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">
              Ho Technical University
            </span>
          </div>
        </div>

        {/* Desktop Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
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

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          className="sm:hidden w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm text-slate-700 dark:text-slate-200 active:scale-95"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden absolute top-full left-4 right-4 mt-2 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col gap-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 text-center text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 text-center text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl shadow-sm transition-all active:scale-95"
            >
              Register
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 md:pt-10 pb-12 md:pb-14 flex-1 flex flex-col justify-center items-center text-center relative overflow-hidden sm:overflow-visible">

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight max-w-4xl leading-[1.1] mb-2 sm:mb-4">
          A secure place to cast your vote.
        </h1>

        {/* Card Deck Section */}
        <div className="relative w-full max-w-4xl my-6 md:my-8 py-2 md:py-4 flex items-center justify-center overflow-visible">

          {/* Floating Tags */}
          <div className="absolute top-0 left-[2%] sm:left-[8%] md:left-[18%] z-30 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-blue-600 text-white text-[10px] md:text-[11px] font-bold shadow-lg shadow-blue-600/20 flex items-center gap-1.5 -rotate-6">
            <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span>@SRC Election</span>
          </div>

          <div className="absolute top-1 right-[2%] sm:right-[8%] md:right-[18%] z-30 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-emerald-600 text-white text-[10px] md:text-[11px] font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 rotate-6">
            <UserCheck className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span>@Department Polls</span>
          </div>

          {/* DESKTOP CARD DECK (5 Cards) - Hidden on small screens */}
          <div className="hidden md:flex items-center justify-center -space-x-8 py-4">

            {/* Card 1 */}
            <div className="w-44 h-60 rounded-3xl overflow-hidden shadow-lg transform -rotate-12 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 dark:border-slate-800/60">
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
            <div className="w-44 h-60 rounded-3xl overflow-hidden shadow-lg transform -rotate-6 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 dark:border-slate-800/60">
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
            <div className="w-52 h-68 rounded-3xl overflow-hidden shadow-2xl z-20 border border-slate-300/70 dark:border-slate-700/70 transform hover:scale-105 transition-all duration-300 flex flex-col justify-end shrink-0 relative group">
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
            <div className="w-44 h-60 rounded-3xl overflow-hidden shadow-lg transform rotate-6 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 dark:border-slate-800/60">
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
            <div className="w-44 h-60 rounded-3xl overflow-hidden shadow-lg transform rotate-12 hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 dark:border-slate-800/60">
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


          {/* SMALL SCREEN CARD DECK (3 Cards Stack) - Only visible on small screens (< md) */}
          <div className="flex md:hidden items-center justify-center -space-x-5 py-4">

            {/* Card 1 (Left) */}
            <div className="w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden shadow-md transform -rotate-12 hover:rotate-0 transition-all duration-300 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 dark:border-slate-800/60">
              <div className="absolute inset-0 w-full h-full bg-[#DBEAFE] dark:bg-slate-800">
                <img src="/assets/school.jpg" alt="Ballot Art 1" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 p-2.5 flex flex-col justify-end">
                <p className="text-[9px] font-bold text-white uppercase tracking-wide bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full w-fit truncate max-w-[90px]">
                  SRC Exec
                </p>
              </div>
            </div>

            {/* Card 2 (Center Stack) */}
            <div className="w-32 h-44 sm:w-40 sm:h-56 rounded-2xl overflow-hidden shadow-xl z-20 border border-slate-300/70 dark:border-slate-700/70 transform transition-all duration-300 flex flex-col justify-end shrink-0 relative group">
              <div className="absolute inset-0 w-full h-full bg-[#F1F5F9] dark:bg-slate-800">
                <img src="/assets/images2.jpeg" alt="Ballot Art 2" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-900/70 p-3 flex flex-col justify-end">
                <p className="text-[9px] font-bold text-white uppercase tracking-wide bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full w-fit truncate max-w-[100px]">
                  Presidential
                </p>
              </div>
            </div>

            {/* Card 3 (Right) */}
            <div className="w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden shadow-md transform rotate-12 hover:rotate-0 transition-all duration-300 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 dark:border-slate-800/60">
              <div className="absolute inset-0 w-full h-full bg-[#D1FAE5] dark:bg-slate-800">
                <img src="/assets/images4.jpeg" alt="Ballot Art 3" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-emerald-900/40 dark:bg-emerald-900/60 p-2.5 flex flex-col justify-end">
                <p className="text-[9px] font-bold text-white uppercase tracking-wide bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full w-fit truncate max-w-[90px]">
                  Dept Reps
                </p>
              </div>
            </div>

          </div>

        </div>

        {/* Subtitle */}
        <p className="text-xs sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto mt-1 mb-6 sm:mb-8 leading-relaxed font-medium px-2">
          Students and voters can securely cast their ballots, explore live election turnout, and verify transparent cryptographic results with total peace of mind.
        </p>

        {/* Primary Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-xs sm:max-w-none">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-full font-bold text-xs shadow-xl shadow-slate-900/10 dark:shadow-none flex items-center justify-center gap-2.5 transition-all active:scale-95"
          >
            <span>Cast Your Vote</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/register"
            className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-full font-bold text-xs shadow-sm flex items-center justify-center transition-all active:scale-95"
          >
            Register Account
          </Link>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/60 dark:border-slate-800/60 py-6 sm:py-8 px-4 sm:px-6 text-center text-xs sm:text-sm text-slate-400 font-medium">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} HTU Elect — Ho Technical University Electronic Voting System.</p>
        </div>
      </footer>

    </div>
  );
}
