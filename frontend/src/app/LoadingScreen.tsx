'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoadingScreen() {
  const [phase, setPhase] = useState<'hidden' | 'splash' | 'woezor'>('hidden');
  const [showButtons, setShowButtons] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'desktop' | 'android' | 'ios'>('desktop');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const android = /android/.test(ua);
    const mobile = /iphone|ipad|ipod|android|mobile/.test(ua);
    setIsIOS(ios);
    setIsMobile(mobile);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    if (ios) setActiveTab('ios');
    else if (android) setActiveTab('android');
    else setActiveTab('desktop');

    if (sessionStorage.getItem('compssa_splash_shown')) {
      setPhase('hidden');
      return;
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
      return () => clearTimeout(toWoezor);
    } else {
      setPhase('woezor');
      const toButtons = setTimeout(() => {
        setShowButtons(true);
        setShowInstallModal(true);
      }, 1800);
      return () => clearTimeout(toButtons);
    }
  }, []);

  const handleContinue = () => {
    sessionStorage.setItem('compssa_splash_shown', '1');
    setPhase('hidden');
    setShowInstallModal(false);
  };

  const instructions = {
    desktop: [
      { icon: '🌐', title: 'Open in Chrome/Edge', text: 'Open COMPSSA in Google Chrome or Microsoft Edge browser.' },
      { icon: '🖥️', title: 'Click Install Icon', text: 'Click the Install Icon (⊕ or 💻) on the right side of the address bar.' },
      { icon: '✅', title: 'Confirm Installation', text: 'Click "Install" in the prompt to launch as an app.' }
    ],
    android: [
      { icon: '⋮', title: 'Open Chrome Menu', text: 'Tap the three-dot menu (⋮) in Chrome\'s top-right corner.' },
      { icon: '📱', title: 'Select Add/Install', text: 'Tap "Add to Home screen" or "Install app" in the list.' },
      { icon: '✅', title: 'Confirm Add', text: 'Tap "Add" or "Install" in the prompt to confirm.' }
    ],
    ios: [
      { icon: '🌐', title: 'Open in Safari', text: 'Open this page in the native Safari browser (not Chrome or in-app).' },
      { icon: '⬆️', title: 'Tap Share Button', text: 'Tap the Share button (□↑) in Safari\'s bottom toolbar.' },
      { icon: '➕', title: 'Add to Home Screen', text: 'Scroll down and tap "Add to Home Screen".' },
      { icon: '✅', title: 'Tap Add to Finish', text: 'Tap "Add" in the top-right corner to complete.' }
    ]
  };

  const currentInstructions = instructions[activeTab];

  const renderFloatingModal = () => (
    <AnimatePresence>
      {showInstallModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInstallModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 999998
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: isMobile ? '100%' : 100, scale: isMobile ? 1 : 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isMobile ? '100%' : 100, scale: isMobile ? 1 : 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              bottom: isMobile ? '0' : '24px',
              right: isMobile ? '0' : '24px',
              left: isMobile ? '0' : 'auto',
              width: isMobile ? '100%' : '400px',
              background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              borderBottomLeftRadius: isMobile ? '0' : '24px',
              borderBottomRightRadius: isMobile ? '0' : '24px',
              padding: '24px',
              boxShadow: '0 12px 50px rgba(0,0,0,0.6)',
              border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.12)',
              borderTop: isMobile ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.12)',
              zIndex: 999999,
              color: '#fff',
              fontFamily: 'sans-serif'
            }}
          >
            <button
              onClick={() => setShowInstallModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingRight: '24px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>📲</div>
              <div>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>Install COMPSSA App</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', margin: '2px 0 0 0' }}>Select your device for a quick setup guide</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <button 
                onClick={() => setActiveTab('desktop')} 
                style={{
                  flex: 1, padding: '8px 4px', border: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'sans-serif',
                  background: activeTab === 'desktop' ? 'linear-gradient(135deg, #6366f1, #2563eb)' : 'transparent',
                  color: activeTab === 'desktop' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  boxShadow: activeTab === 'desktop' ? '0 4px 12px rgba(99,102,241,0.4)' : 'none'
                }}
              >
                💻 Desktop
              </button>
              <button 
                onClick={() => setActiveTab('android')} 
                style={{
                  flex: 1, padding: '8px 4px', border: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'sans-serif',
                  background: activeTab === 'android' ? 'linear-gradient(135deg, #6366f1, #2563eb)' : 'transparent',
                  color: activeTab === 'android' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  boxShadow: activeTab === 'android' ? '0 4px 12px rgba(99,102,241,0.4)' : 'none'
                }}
              >
                📱 Android
              </button>
              <button 
                onClick={() => setActiveTab('ios')} 
                style={{
                  flex: 1, padding: '8px 4px', border: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'sans-serif',
                  background: activeTab === 'ios' ? 'linear-gradient(135deg, #6366f1, #2563eb)' : 'transparent',
                  color: activeTab === 'ios' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  boxShadow: activeTab === 'ios' ? '0 4px 12px rgba(99,102,241,0.4)' : 'none'
                }}
              >
                🍎 iOS
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '140px' }}>
              {currentInstructions.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a5b4fc', fontWeight: '700', fontSize: '0.75rem' }}>
                    {i + 1}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingTop: '2px' }}>
                    <span style={{ fontSize: '1.1rem', lineHeight: '1.2' }}>{s.icon}</span>
                    <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                      <strong style={{ color: '#818cf8', display: 'block', marginBottom: '2px' }}>{s.title}</strong>
                      <span style={{ color: 'rgba(255,255,255,0.85)' }}>{s.text}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #2563eb)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)'
              }}
            >
              Got it!
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  const renderFloatingTrigger = () => {
    if (isStandalone) return null;
    return (
      <>
        {!showInstallModal && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setShowInstallModal(true)}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              padding: '12px 20px',
              borderRadius: '30px',
              background: 'linear-gradient(135deg, #6366f1, #2563eb)',
              color: '#fff',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '13px',
              boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 9999
            }}
          >
            <span>📲</span> Install App
          </motion.button>
        )}
        {renderFloatingModal()}
      </>
    );
  };

  if (phase === 'hidden') {
    return renderFloatingTrigger();
  }

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
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            width: '100%',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '120px',
              height: '120px',
              borderRadius: '32px',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.03) 100%)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backdropFilter: 'blur(20px)',
            }}
          >
            <span style={{ fontSize: '4rem', filter: 'drop-shadow(0 4px 12px rgba(37,99,235,0.3))' }}>✓</span>
          </div>

          <h1
            style={{
              color: '#fff',
              fontSize: '2.5rem',
              fontWeight: 800,
              letterSpacing: '1px',
              margin: '0.5rem 0 0',
              fontFamily: 'var(--font-display), sans-serif',
              textShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            Woezor <span style={{ color: '#60a5fa' }}>✓</span>
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '1.15rem',
            fontWeight: 500,
            letterSpacing: '0.5px',
            fontFamily: 'var(--font-display), sans-serif',
            margin: '-1.5rem 0 0',
          }}
        >
          E-VOTE
        </motion.p>

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
                onClick={handleContinue}
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
        VoteHTU <span style={{ color: '#2563eb' }}>✓</span>
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
