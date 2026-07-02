'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function LoadingScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<'hidden' | 'splash' | 'woezor'>('hidden');
  const [showButtons, setShowButtons] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  // Capture the beforeinstallprompt event ASAP
  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    // Show on every visit (not just standalone) since the page is now the entry point
    setPhase('splash');

    const woezorTimer = setTimeout(() => {
      setPhase('woezor');
    }, 5000);

    // After Woezor appears, let it rise then show buttons
    const buttonsTimer = setTimeout(() => {
      setShowButtons(true);
    }, 6800); // 5s splash + 1.8s for woezor to animate up

    return () => {
      clearTimeout(woezorTimer);
      clearTimeout(buttonsTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      alert(
        'To install Votick on iOS:\n\n' +
        '1. Tap the Share button (□↑) at the bottom of Safari\n' +
        '2. Scroll down and tap "Add to Home Screen"\n' +
        '3. Tap "Add" to confirm'
      );
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      alert(
        'To install Votick:\n\n' +
        '• Chrome: Click the install icon (⊕) in the address bar\n' +
        '• Edge: Click "App available" in the address bar'
      );
    }
  };

  const handleContinue = () => {
    router.push('/login');
  };

  if (phase === 'hidden') return null;

  /* ─── WOEZOR SCREEN ─────────────────────────────────────────── */
  if (phase === 'woezor') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(160deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          gap: '2rem',
          overflow: 'hidden',
        }}
      >
        {/* Background glow orbs */}
        <div style={{
          position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
          top: '10%', left: '20%', filter: 'blur(60px)'
        }} />
        <div style={{
          position: 'absolute', width: '300px', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.4) 0%, transparent 70%)',
          bottom: '15%', right: '15%', filter: 'blur(50px)'
        }} />

        {/* WOEZOR text — rises up when buttons appear */}
        <motion.h1
          initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
          animate={{
            opacity: 1,
            y: showButtons ? -30 : 0,
            filter: 'blur(0px)',
          }}
          transition={{
            opacity: { duration: 1.2, ease: 'easeOut' },
            filter: { duration: 1.2, ease: 'easeOut' },
            y: showButtons
              ? { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }
              : { duration: 1.2, ease: 'easeOut' },
          }}
          style={{
            fontFamily: "'Dancing Script', 'Brush Script MT', 'Lucida Handwriting', cursive",
            fontSize: 'clamp(3.5rem, 10vw, 6rem)',
            color: '#ffffff',
            textShadow: '0 4px 30px rgba(99,102,241,0.6), 0 0 60px rgba(255,255,255,0.15)',
            margin: 0,
            letterSpacing: '4px',
          }}
        >
          Woezor
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: showButtons ? 0 : 0.7 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '1rem',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-display), sans-serif',
            margin: '-1.5rem 0 0',
          }}
        >
          Welcome
        </motion.p>

        {/* Buttons appear after Woezor rises */}
        <AnimatePresence>
          {showButtons && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                marginTop: '1rem',
                width: '100%',
                maxWidth: '320px',
                padding: '0 1.5rem',
              }}
            >
              {/* Install App */}
              <button
                onClick={handleInstall}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #2563eb)',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 8px 32px rgba(99,102,241,0.5)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.03)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(99,102,241,0.65)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.5)';
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>⬇</span>
                {isIOS ? 'Add to Home Screen' : 'Install App'}
              </button>

              {/* Continue on Website */}
              <button
                onClick={handleContinue}
                style={{
                  width: '100%',
                  padding: '13px 24px',
                  borderRadius: '14px',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(8px)',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  letterSpacing: '0.3px',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.5)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)';
                }}
              >
                Continue on Website →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ─── SPLASH SCREEN ─────────────────────────────────────────── */
  const gridSize = 8;
  const grid = Array.from({ length: gridSize * gridSize }, (_, i) => i);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
        overflow: 'hidden',
      }}
    >
      {/* Scatter logo */}
      <motion.div
        initial="initial"
        animate="animate"
        variants={{
          initial: { y: -300, opacity: 0 },
          animate: {
            y: 0,
            opacity: 1,
            transition: { duration: 1.5, ease: 'easeOut' },
          },
        }}
        style={{ position: 'relative', width: 160, height: 160, marginBottom: '2rem' }}
      >
        <motion.div
          animate={{ rotate: [0, 0, 360, 360] }}
          transition={{ duration: 4, times: [0, 0.4, 0.8, 1], ease: 'easeInOut' }}
          style={{ width: '100%', height: '100%', position: 'relative' }}
        >
          {grid.map((index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const xOffset = col * (100 / gridSize);
            const yOffset = row * (100 / gridSize);
            const randX = (Math.random() - 0.5) * 400;
            const randY = (Math.random() - 0.5) * 400;
            const randRot = (Math.random() - 0.5) * 360;

            return (
              <motion.div
                key={index}
                initial="assembled"
                animate="shatter"
                variants={{
                  assembled: { x: 0, y: 0, rotate: 0, opacity: 1 },
                  shatter: {
                    x: [0, randX, 0],
                    y: [0, randY, 0],
                    rotate: [0, randRot, 0],
                    opacity: [1, 0.5, 1],
                    transition: {
                      duration: 3,
                      delay: 1,
                      times: [0, 0.5, 1],
                      ease: 'easeInOut',
                    },
                  },
                }}
                style={{
                  position: 'absolute',
                  width: `${100 / gridSize}%`,
                  height: `${100 / gridSize}%`,
                  left: `${xOffset}%`,
                  top: `${yOffset}%`,
                  backgroundImage: "url('/icons/logo.png')",
                  backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                  backgroundPosition: `${(col / (gridSize - 1)) * 100}% ${(row / (gridSize - 1)) * 100}%`,
                  mixBlendMode: 'multiply',
                }}
              />
            );
          })}
        </motion.div>
      </motion.div>

      {/* VOTICK wordmark */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#0f172a',
          fontSize: '2.5rem',
          fontWeight: '800',
          letterSpacing: '2px',
          fontFamily: 'var(--font-display), sans-serif',
          marginBottom: '2rem',
        }}
      >
        VOTICK <span style={{ color: '#2563eb' }}>✓</span>
      </motion.div>

      {/* Loading bar */}
      <div style={{ width: '250px', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          style={{ width: '100%', height: '100%', background: '#2563eb', borderRadius: '2px' }}
        />
      </div>
    </div>
  );
}
