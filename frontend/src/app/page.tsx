'use client';

import React from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Fingerprint,
  ScrollText,
  BarChart3,
  Activity,
  Vote,
  Lock,
  BadgeCheck,
  Menu,
  X,
  Sparkles,
  Users,
  Landmark,
  CheckCircle2,
  Eye,
  Timer,
  UserPlus,
} from 'lucide-react';

export default function LandingPage() {
  // Close the native <details> menu after tapping a link (progressive
  // enhancement — the menu works even if React never hydrates on old devices).
  const closeMobileMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const details = (e.currentTarget as HTMLElement).closest('details');
    if (details) details.open = false;
  };

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
  ];

  return (
    // Landing page is intentionally light-only: dark: variants are stripped so it
    // always renders in light mode even if the app's dashboard theme toggle set
    // data-theme="dark" earlier in the session.
    <div className="landing-page min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white transition-colors duration-200 antialiased">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      {/* No backdrop-blur here: backdrop-filter on sticky elements has an iOS
          Safari hit-testing bug that swallows taps on the hamburger menu. */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-slate-50">
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard navigation is intentional for static cPanel exports */}
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm border border-slate-200/80 group-hover:scale-105 transition-transform">
              <img src="/assets/logo.png" alt="HTU Elect Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-base sm:text-lg text-slate-900 tracking-tight leading-none">
                HTU Elect
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">
                Ho Technical University
              </span>
            </div>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href="/login"
              className="px-5 py-2.5 text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors"
            >
              Sign In
            </a>
            <a
              href="/register"
              className="px-5 py-2.5 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-sm transition-all active:scale-95"
            >
              Register
            </a>
          </div>

          {/* Mobile hamburger — native <details>/<summary> disclosure.
              No JS or React state required to open/close: the browser
              handles the toggle natively, so it works even on old iOS
              Safari (iPhone 6s) where the onClick handler can fail to
              attach. Icon swaps via the CSS `open` state (group-open). */}
          <details className="md:hidden group relative">
            <summary
              aria-label="Toggle navigation menu"
              className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm text-slate-700 active:scale-95 touch-manipulation cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden"
            >
              <Menu className="w-5 h-5 group-open:hidden" />
              <X className="w-5 h-5 hidden group-open:block" />
            </summary>

            {/* Mobile menu dropdown */}
            <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-[19rem] p-2 bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col gap-1 z-50">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="w-full py-3 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors touch-manipulation cursor-pointer"
                >
                  {link.label}
                </a>
              ))}
              <div className="h-px bg-slate-100 my-1" />
              <a
                href="/login"
                onClick={closeMobileMenu}
                className="w-full py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors touch-manipulation cursor-pointer"
              >
                Sign In
              </a>
              <a
                href="/register"
                onClick={closeMobileMenu}
                className="w-full py-3 text-center text-sm font-bold bg-slate-900 text-white rounded-xl shadow-sm transition-all active:scale-95 touch-manipulation cursor-pointer"
              >
                Register
              </a>
            </div>
          </details>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background flair */}
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 md:pt-20 pb-14 md:pb-20 flex flex-col items-center text-center">
          {/* Announcement badge */}
          <div className="landing-reveal inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-[11px] sm:text-xs font-bold text-slate-600 mb-7">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            HTU SRC, Hall &amp; Department Elections — now online
          </div>

          {/* Headline */}
          <h1 className="landing-reveal text-4xl sm:text-6xl md:text-7xl font-black tracking-tight max-w-4xl leading-[1.06] mb-5" style={{ animationDelay: '0.1s' }}>
            Your vote. Secured. Counted.{' '}
            <span className="text-blue-600">
              Verified.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="landing-reveal text-sm sm:text-lg text-slate-600 max-w-2xl mx-auto mb-4 leading-relaxed font-medium" style={{ animationDelay: '0.2s' }}>
            HTU Elect is Ho Technical University&apos;s trusted electronic voting platform. One voter,
            one ballot, and a cryptographic audit trail behind every single vote.
          </p>

          {/* Micro trust row — desktop only; hidden on mobile for simplicity */}
          <div className="landing-reveal hidden sm:flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-9" style={{ animationDelay: '0.3s' }}>
            {['OTP-verified identity', 'SHA-256 audit trail', 'Real-time results'].map((item) => (
              <span
                key={item}
                className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-500"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {item}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="landing-reveal flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-xs sm:max-w-none" style={{ animationDelay: '0.35s' }}>
            <a
              href="/login"
              className="w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-sm shadow-xl shadow-blue-600/25 hover:shadow-blue-600/40 flex items-center justify-center gap-2.5 transition-all active:scale-95"
            >
              <Vote className="w-4 h-4" />
              <span>Cast Your Vote</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/register"
              className="w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80 rounded-full font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              Create Account
            </a>
          </div>

          {/* Hero visual — campus ballot deck */}
          <div className="landing-reveal relative w-full max-w-4xl mt-10 md:mt-20 py-2 md:py-4 flex items-center justify-center" style={{ animationDelay: '0.45s' }}>
            {/* Glow behind deck */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-56 md:h-72 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

            {/* Floating chips — desktop only; hidden on mobile for simplicity */}
            <div className="absolute top-0 left-[2%] sm:left-[6%] md:left-[16%] z-30 px-3 py-1.5 md:px-4 md:py-1.5 rounded-full bg-slate-900 text-white text-[10px] md:text-[11px] font-bold shadow-lg shadow-slate-900/20 items-center gap-1.5 -rotate-3 hidden sm:flex">
              <ShieldCheck className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-400" />
              <span>Audit-trail verified</span>
            </div>

            {/* Floating turnout chip */}
            <div className="absolute top-1 right-[2%] sm:right-[6%] md:right-[16%] z-30 px-3 py-1.5 md:px-4 md:py-1.5 rounded-full bg-blue-600 text-white text-[10px] md:text-[11px] font-bold shadow-lg shadow-blue-600/25 items-center gap-1.5 rotate-3 hidden sm:flex">
              <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>Live turnout</span>
            </div>

            {/* Desktop deck */}
            <div className="hidden md:flex items-center justify-center -space-x-8 py-4">
              {[
                { src: '/assets/school.jpg', label: 'SRC Executive', rotate: '-rotate-12', tint: 'bg-slate-900/40' },
                { src: '/assets/images1.jpeg', label: 'Faculty Election', rotate: '-rotate-6', tint: 'bg-blue-900/40' },
                { src: '/assets/images2.jpeg', label: 'Presidential & Local', rotate: 'rotate-0', center: true },
                { src: '/assets/images3.jpeg', label: 'Hall Residence', rotate: 'rotate-6', tint: 'bg-amber-900/40' },
                { src: '/assets/images4.jpeg', label: 'Department Reps', rotate: 'rotate-12', tint: 'bg-emerald-900/40' },
              ].map((card, i) => (
                <div
                  key={i}
                  className={`w-44 h-60 rounded-3xl overflow-hidden shadow-lg transform ${card.rotate} hover:rotate-0 transition-all duration-300 hover:z-40 hover:scale-105 flex flex-col justify-end shrink-0 relative group border border-slate-200/60 ${
                    card.center ? 'w-52 h-68 rounded-3xl shadow-2xl z-20 border-slate-300/70' : ''
                  }`}
                >
                  <div className="absolute inset-0 w-full h-full bg-slate-200">
                    <img src={card.src} alt={card.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className={`absolute inset-0 ${card.tint || 'bg-slate-900/50'} p-4 flex flex-col justify-end`}>
                    <p className="text-[10px] font-bold text-white uppercase tracking-wide bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full w-fit">
                      {card.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile deck — three overlapping cards */}
            <div className="flex md:hidden items-center justify-center -space-x-5 py-4">
              {[
                { src: '/assets/school.jpg', label: 'SRC Exec', rotate: '-rotate-12', tint: 'bg-slate-900/40' },
                { src: '/assets/images2.jpeg', label: 'Presidential', rotate: 'rotate-0', center: true },
                { src: '/assets/images4.jpeg', label: 'Dept Reps', rotate: 'rotate-12', tint: 'bg-emerald-900/40' },
              ].map((card, i) => (
                <div
                  key={i}
                  className={`w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden shadow-md transform ${card.rotate} flex flex-col justify-end shrink-0 relative group border border-slate-200/60 ${
                    card.center ? 'w-32 h-44 sm:w-40 sm:h-56 rounded-2xl shadow-xl z-20 border-slate-300/70' : ''
                  }`}
                >
                  <div className="absolute inset-0 w-full h-full bg-slate-200">
                    <img src={card.src} alt={card.label} className="w-full h-full object-cover" />
                  </div>
                  <div className={`absolute inset-0 ${card.tint || 'bg-slate-900/50'} p-2.5 flex flex-col justify-end`}>
                    <p className="text-[9px] font-bold text-white uppercase tracking-wide bg-black/40 px-2 py-0.5 rounded-full w-fit truncate max-w-[90px]">
                      {card.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200/60 bg-white">
        <div className="landing-reveal max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { icon: Vote, stat: '1 voter', label: 'exactly 1 ballot' },
            { icon: ScrollText, stat: 'SHA-256', label: 'cryptographic audit' },
            { icon: Activity, stat: '24/7', label: 'fraud monitoring' },
            { icon: Eye, stat: '100%', label: 'verifiable results' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center text-center gap-1.5">
              <s.icon className="w-5 h-5 text-blue-600 mb-1" />
              <span className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">{s.stat}</span>
              <span className="text-xs font-semibold text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="relative scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <div className="max-w-2xl mx-auto text-center mb-12 md:mb-16">
            <span className="landing-reveal inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Why HTU Elect
            </span>
            <h2 className="landing-reveal text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-4" style={{ animationDelay: '0.1s' }}>
              Built for trust, engineered for <span className="text-blue-600">speed</span>
            </h2>
            <p className="landing-reveal text-sm sm:text-base text-slate-600 font-medium leading-relaxed" style={{ animationDelay: '0.2s' }}>
              Every layer of the platform — from sign-in to the final tally — is designed to keep
              the process fair, fast, and fully accountable.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Lock,
                title: 'Secure email & password sign-in',
                desc: 'Register with your student email, then unlock every ballot with a one-time code delivered straight to your inbox.',
              },
              {
                icon: Fingerprint,
                title: 'One voter, one ballot',
                desc: 'The system enforces a unique ballot per voter — duplicate or double casting is blocked at the database level.',
              },
              {
                icon: ScrollText,
                title: 'Cryptographic audit trail',
                desc: 'Every cast ballot appends to an immutable SHA-256 ledger, so the final count can always be independently verified.',
              },
              {
                icon: BarChart3,
                title: 'Real-time results & turnout',
                desc: 'Admins watch live turnout per position while voters see verified results the moment polls close.',
              },
              {
                icon: Activity,
                title: 'Fraud monitoring & rate limits',
                desc: 'Anomaly alerts and rate-limited APIs protect every election against brute-force and ballot-stuffing attempts.',
              },
              {
                icon: Landmark,
                title: 'Elections for every level',
                desc: 'One platform for SRC executives, hall residences, faculty boards, and department reps — with per-tenant isolation.',
              },
            ].map((f, i) => (
              <div
                key={f.title}
                className="landing-reveal group relative p-6 md:p-7 rounded-3xl bg-white border border-slate-200/70 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  <f.icon className="w-5 h-5 text-blue-600 group-hover:text-white" />
                </div>
                <h3 className="text-base md:text-lg font-bold text-slate-900 mb-2 leading-snug">{f.title}</h3>
                <p className="text-[13px] md:text-sm text-slate-500 leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative scroll-mt-20 bg-white border-y border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <div className="max-w-2xl mx-auto text-center mb-12 md:mb-16">
            <span className="landing-reveal inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-bold uppercase tracking-wider mb-4">
              <Timer className="w-3.5 h-3.5" />
              How it works
            </span>
            <h2 className="landing-reveal text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-4" style={{ animationDelay: '0.1s' }}>
              From sign-up to results in <span className="text-emerald-600">four steps</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                step: '01',
                icon: Users,
                title: 'Create your account',
                desc: 'Register with your student email address and set a secure password.',
              },
              {
                step: '02',
                icon: BadgeCheck,
                title: 'Verify with OTP',
                desc: 'A 6-digit code is emailed to you — enter it to unlock the ballot.',
              },
              {
                step: '03',
                icon: Vote,
                title: 'Cast your ballot',
                desc: 'Choose your candidates, review, and confirm. One vote per voter, guaranteed.',
              },
              {
                step: '04',
                icon: Eye,
                title: 'Watch verified results',
                desc: 'Live turnout for admins, audited results for everyone the moment voting ends.',
              },
            ].map((s, i) => (
              <div key={s.step} className="landing-reveal relative" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="p-6 md:p-7 rounded-3xl border border-slate-200/70 bg-slate-50 h-full">
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                      {s.step}
                    </div>
                    <s.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{s.title}</h3>
                  <p className="text-[13px] text-slate-500 leading-relaxed font-medium">{s.desc}</p>
                </div>
                {i < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-4 h-px bg-slate-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ───────────────────────────────────────────────────── */}
      <section className="pb-16 md:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="landing-reveal relative rounded-[2rem] bg-blue-600 overflow-hidden px-6 py-14 md:py-20 text-center">
            <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 text-white text-[11px] font-bold uppercase tracking-wider mb-6 border border-white/20">
                <Vote className="w-3.5 h-3.5" />
                Election season is live
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight mb-4">
                Make your voice count today
              </h2>
              <p className="text-sm sm:text-base text-blue-100 font-medium max-w-xl mx-auto mb-8 leading-relaxed">
                Sign in, verify your identity, and cast your ballot in minutes — from any phone,
                anywhere on campus.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <a
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-100 text-blue-700 rounded-full font-bold text-sm shadow-xl flex items-center justify-center gap-2.5 transition-all active:scale-95"
                >
                  Cast Your Vote
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="/register"
                  className="w-full sm:w-auto px-8 py-4 bg-blue-500/40 hover:bg-blue-500/60 text-white border border-white/30 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  Register Account
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200/60 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm border border-slate-200/80">
              <img src="/assets/logo.png" alt="HTU Elect Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-sm text-slate-900 tracking-tight leading-none">HTU Elect</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">Ho Technical University</span>
            </div>
          </div>

          <nav className="flex items-center gap-6 text-xs font-bold text-slate-500">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How it works</a>
            <a href="/login" className="hover:text-blue-600 transition-colors">Sign In</a>
            <a href="/register" className="hover:text-blue-600 transition-colors">Register</a>
          </nav>

          <p className="text-[11px] sm:text-xs text-slate-400 font-medium text-center md:text-right">
            &copy; {new Date().getFullYear()} HTU Elect — Secure Electronic Voting System.
          </p>
        </div>
      </footer>
    </div>
  );
}
