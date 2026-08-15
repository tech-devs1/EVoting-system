'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  Lock,
  Vote,
  Award,
  Users
} from 'lucide-react';

interface CarouselSlide {
  id: number;
  title: string;
  category: string;
  image: string;
  tagBg: string;
  badge: string;
}

const CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    id: 1,
    title: "SRC Executive Elections",
    category: "Student Representative Council",
    image: "/assets/school.jpg",
    tagBg: "bg-blue-600",
    badge: "@SRC Election"
  },
  {
    id: 2,
    title: "Faculty & Department Polls",
    category: "Academic Faculties",
    image: "/assets/images1.jpeg",
    tagBg: "bg-indigo-600",
    badge: "@Faculty Polls"
  },
  {
    id: 3,
    title: "Presidential & Local Council",
    category: "Campus General",
    image: "/assets/images2.jpeg",
    tagBg: "bg-emerald-600",
    badge: "@Presidential"
  },
  {
    id: 4,
    title: "Hall Residence Leadership",
    category: "Residential Halls",
    image: "/assets/images3.jpeg",
    tagBg: "bg-amber-600",
    badge: "@Hall Residence"
  },
  {
    id: 5,
    title: "Department Representatives",
    category: "Student Associations",
    image: "/assets/images4.jpeg",
    tagBg: "bg-teal-600",
    badge: "@Department Reps"
  }
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Auto-play timer
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] text-slate-900 dark:text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white transition-colors duration-200 overflow-x-hidden">

      {/* Header / Hamburger Navigation */}
      <header className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between z-50 border-b border-slate-200/60 dark:border-slate-800/60">
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

        {/* Hamburger Toggle Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Hamburger Dropdown Menu */}
        {menuOpen && (
          <div className="absolute top-full right-4 sm:right-6 mt-2 w-56 sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex flex-col gap-1.5">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="w-full px-4 py-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
              >
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link
                href="/register"
                onClick={() => setMenuOpen(false)}
                className="w-full px-4 py-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-between shadow-md shadow-blue-500/10"
              >
                <span>Register</span>
                <ArrowRight className="w-3.5 h-3.5 text-white/80" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-12 flex-1 flex flex-col justify-center items-center text-center relative w-full">

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight max-w-4xl leading-[1.15] sm:leading-[1.1] mb-4">
          A secure place to cast your vote.
        </h1>

        {/* Auto-Playing Carousel Section */}
        <div
          className="relative w-full max-w-2xl my-6 sm:my-8 px-2 sm:px-4"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Main Card Container */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none aspect-[16/10] sm:aspect-[16/9] md:aspect-[2/1] group">
            {CAROUSEL_SLIDES.map((slide, idx) => {
              const isActive = idx === currentIndex;
              return (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-4 sm:p-6 md:p-8 flex flex-col justify-between text-left">
                    {/* Badge */}
                    <div className="flex justify-start">
                      <span className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold text-white shadow-md flex items-center gap-1.5 ${slide.tagBg}`}>
                        <Sparkles className="w-3 h-3" />
                        <span>{slide.badge}</span>
                      </span>
                    </div>

                    {/* Bottom Title Info */}
                    <div>
                      <p className="text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        {slide.category}
                      </p>
                      <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        {slide.title}
                      </h3>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Navigation Arrows */}
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 hover:scale-110"
              aria-label="Previous Slide"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 hover:scale-110"
              aria-label="Next Slide"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Indicators / Pagination Dots */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {CAROUSEL_SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`transition-all duration-300 rounded-full ${
                  idx === currentIndex
                    ? 'w-7 h-2 bg-blue-600'
                    : 'w-2 h-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto mt-2 mb-8 leading-relaxed font-medium px-2">
          Students and voters can securely cast their ballots, explore live election turnout, and verify transparent cryptographic results with total peace of mind.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-xs sm:max-w-none">
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
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>&copy; {new Date().getFullYear()} HTU Elect — Ho Technical University Electronic Voting System.</p>
        </div>
      </footer>

    </div>
  );
}
