'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── DOM-based install modal — injected directly, bypasses React state issues ───
function showInstallInstructions(isIOS: boolean) {
  // Remove any existing modal
  const existing = document.getElementById('compssa-install-overlay');
  if (existing) existing.remove();

  const isAndroid = !isIOS;

  const steps = isIOS
    ? [
        { icon: '🌐', text: 'Open this page in <b style="color:#60a5fa">Safari</b> (not Chrome or other browsers)' },
        { icon: '⬆️', text: 'Tap the <b style="color:#60a5fa">Share</b> button (□↑) at the bottom of the screen' },
        { icon: '➕', text: 'Scroll down and tap <b style="color:#60a5fa">"Add to Home Screen"</b>' },
        { icon: '✅', text: 'Tap <b style="color:#60a5fa">"Add"</b> in the top-right corner to confirm' },
      ]
    : [
        { icon: '⋮', text: 'Tap the <b style="color:#60a5fa">three-dot menu</b> (⋮) in Chrome\'s top-right corner' },
        { icon: '📱', text: 'Tap <b style="color:#60a5fa">"Add to Home screen"</b> or <b style="color:#60a5fa">"Install app"</b>' },
        { icon: '✅', text: 'Tap <b style="color:#60a5fa">"Add"</b> to confirm' },
      ];

  const stepsHTML = steps
    .map(
      (s, i) => `
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:18px">
        <div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.5);display:flex;align-items:center;justify-content:center;color:#a5b4fc;font-weight:700;font-size:0.82rem;font-family:sans-serif">${i + 1}</div>
        <div style="display:flex;align-items:flex-start;gap:10px;padding-top:2px">
          <span style="font-size:1.25rem;line-height:1.3">${s.icon}</span>
          <p style="color:rgba(255,255,255,0.85);font-size:0.9rem;margin:0;line-height:1.55;font-family:sans-serif">${s.text}</p>
        </div>
      </div>`
    )
    .join('');

  const html = `
    <div id="compssa-install-overlay" style="position:fixed;inset:0;z-index:9999999;display:flex;align-items:flex-end">
      <!-- Backdrop -->
      <div id="compssa-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(6px)"></div>
      <!-- Sheet -->
      <div id="compssa-sheet" style="position:relative;width:100%;background:linear-gradient(160deg,#0f172a 0%,#1a2a5e 100%);border-radius:28px 28px 0 0;padding:12px 24px 48px;box-shadow:0 -8px 60px rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.1);transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.34,1.2,0.64,1)">
        <!-- Handle -->
        <div style="width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,0.25);margin:0 auto 24px"></div>
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px">
          <div style="width:52px;height:52px;border-radius:16px;flex-shrink:0;background:linear-gradient(135deg,#6366f1,#2563eb);display:flex;align-items:center;justify-content:center;font-size:1.6rem;box-shadow:0 4px 20px rgba(99,102,241,0.5)">📲</div>
          <div>
            <p style="color:#fff;font-weight:700;font-size:1.15rem;margin:0;line-height:1.2;font-family:sans-serif">Install COMPSSA</p>
            <p style="color:rgba(255,255,255,0.45);font-size:0.82rem;margin:4px 0 0;font-family:sans-serif">${isIOS ? 'Add to your iPhone Home Screen' : 'Add to your Android Home Screen'}</p>
          </div>
        </div>
        <!-- Steps -->
        ${stepsHTML}
        <!-- Button -->
        <button id="compssa-got-it" style="margin-top:16px;width:100%;padding:15px;border-radius:14px;border:none;background:linear-gradient(135deg,#6366f1,#2563eb);color:#fff;font-size:1rem;font-weight:700;cursor:pointer;font-family:sans-serif;letter-spacing:0.5px">Got it!</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  // Animate sheet in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const sheet = document.getElementById('compssa-sheet');
      if (sheet) sheet.style.transform = 'translateY(0)';
    });
  });

  // Close handlers
  const close = () => {
    const sheet = document.getElementById('compssa-sheet');
    if (sheet) {
      sheet.style.transform = 'translateY(100%)';
      setTimeout(() => document.getElementById('compssa-install-overlay')?.remove(), 350);
    }
  };
  document.getElementById('compssa-got-it')?.addEventListener('click', close);
  document.getElementById('compssa-backdrop')?.addEventListener('click', close);
}

export default function LoadingScreen() {
  const [phase, setPhase] = useState<'hidden' | 'splash' | 'woezor'>('hidden');
  const [showButtons, setShowButtons] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  // Dropdown for install instructions
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    // Capture beforeinstallprompt but we no longer use it for the modal
    const handler = (e: Event) => { e.preventDefault(); };
    window.addEventListener('beforeinstallprompt', handler);

    if (sessionStorage.getItem('compssa_splash_shown')) {
      setPhase('hidden');
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }

    if (standalone) {
      setPhase('splash');
      const toWoezor = setTimeout(() => {
        setPhase('woezor');
        const toDismiss = setTimeout(() => {
          sessionStorage.setItem('compssa_splash_shown', '1');
          setPhase('hidden');
        }, 2500);
        return () => clearTimeout(toDismiss);
      }, 5000);
      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(toWoezor);
      };
    } else {
      setPhase('woezor');
      const toButtons = setTimeout(() => setShowButtons(true), 1800);
      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(toButtons);
      };
    }
  }, []);

  const handleInstall = () => {
    showInstallInstructions(isIOS);
  };

  const handleContinue = () => {
    sessionStorage.setItem('compssa_splash_shown', '1');
    setPhase('hidden');
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

        {/* COMPSSA logo */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.85 }}
          animate={{ opacity: 1, y: showButtons ? -30 : 0, scale: 1 }}
          transition={{
            opacity: { duration: 0.9, ease: 'easeOut' },
            scale: { duration: 0.9, ease: 'easeOut' },
            y: showButtons
              ? { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }
              : { duration: 0.9, ease: 'easeOut' },
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '-0.5rem' }}
        >
          <span style={{
            fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
            fontSize: 'clamp(3rem, 12vw, 7.5rem)',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-2px',
            lineHeight: 1,
            textShadow: '0 0 40px rgba(99,102,241,0.7), 0 4px 20px rgba(0,0,0,0.4)',
          }}>
            COMPSSA ELECTIONS
          </span>
          <span style={{
            fontSize: 'clamp(2rem, 8vw, 5rem)',
            color: '#60a5fa',
            lineHeight: 1,
            fontWeight: 900,
            textShadow: '0 0 30px rgba(96,165,250,0.8)',
            marginTop: '-0.25em',
          }}>
            ✓
          </span>
        </motion.div>

        {/* WOEZOR text */}
        <motion.h1
          initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: showButtons ? -30 : 0, filter: 'blur(0px)' }}
          transition={{
            opacity: { duration: 1.2, ease: 'easeOut', delay: 0.3 },
            filter: { duration: 1.2, ease: 'easeOut', delay: 0.3 },
            y: showButtons
              ? { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }
              : { duration: 1.2, ease: 'easeOut', delay: 0.3 },
          }}
          style={{
            fontFamily: "'Dancing Script', 'Brush Script MT', 'Lucida Handwriting', cursive",
            fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 4px 30px rgba(99,102,241,0.6), 0 0 60px rgba(255,255,255,0.15)',
            margin: 0,
            letterSpacing: '6px',
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

        {/* Action Buttons */}
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
              <button
                onClick={() => setShowDropdown(prev => !prev)}
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
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{isIOS ? '📲' : '⬇'}</span>
                {isIOS ? 'Add to Home Screen' : 'Install App'}
              </button>

              {/* Dropdown instruction menu */}
              {showDropdown && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(160deg, #0f172a, #1a2a5e)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                  zIndex: 1000,
                }}>
                  {/* Steps list */}
                  {(
                    isIOS
                      ? [
                          { icon: '🌐', text: 'Open this page in Safari (not Chrome or other browsers)' },
                          { icon: '⬆️', text: 'Tap the Share button (□↑) at the bottom of the screen' },
                          { icon: '➕', text: 'Scroll down and tap "Add to Home Screen"' },
                          { icon: '✅', text: 'Tap "Add" in the top‑right corner to confirm' },
                        ]
                      : [
                          { icon: '⋮', text: "Tap the three‑dot menu (⋮) in Chrome's top‑right corner" },
                          { icon: '📱', text: 'Tap "Add to Home screen" or "Install app"' },
                          { icon: '✅', text: 'Tap "Add" to confirm' },
                        ]
                  ).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                      <p style={{ color: '#fff', margin: 0, fontSize: '0.9rem' }}>{s.text}</p>
                    </div>
                  ))}
                  <button
                    onClick={() => setShowDropdown(false)}
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      padding: '8px',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              )}


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
      <motion.div
        initial="initial"
        animate="animate"
        variants={{
          initial: { y: -300, opacity: 0 },
          animate: { y: 0, opacity: 1, transition: { duration: 1.5, ease: 'easeOut' } },
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
                    x: [0, randX, 0], y: [0, randY, 0], rotate: [0, randRot, 0], opacity: [1, 0.5, 1],
                    transition: { duration: 3, delay: 1, times: [0, 0.5, 1], ease: 'easeInOut' },
                  },
                }}
                style={{
                  position: 'absolute',
                  width: `${100 / gridSize}%`, height: `${100 / gridSize}%`,
                  left: `${xOffset}%`, top: `${yOffset}%`,
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          color: '#0f172a', fontSize: '2.5rem', fontWeight: '800',
          letterSpacing: '2px', fontFamily: 'var(--font-display), sans-serif', marginBottom: '2rem',
        }}
      >
        COMPSSA <span style={{ color: '#2563eb' }}>✓</span>
      </motion.div>

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
