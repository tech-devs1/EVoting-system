'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function LoadingScreen() {
  const [phase, setPhase] = useState<'hidden' | 'splash' | 'woezor'>('hidden');

  useEffect(() => {
    // Only show the splash screen if launched in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                      || (window.navigator as any).standalone 
                      || document.referrer.includes('android-app://');
    
    if (!isStandalone) {
      return;
    }

    setPhase('splash');

    const woezorTimer = setTimeout(() => {
      setPhase('woezor');
    }, 5000);

    const hideTimer = setTimeout(() => {
      setPhase('hidden');
    }, 8000);

    return () => {
      clearTimeout(woezorTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === 'hidden') return null;

  if (phase === 'woezor') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#2563eb', // Beautiful primary blue background
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
        }}
      >
        <motion.h1
          initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{
            fontFamily: "'Dancing Script', 'Brush Script MT', 'Lucida Handwriting', cursive",
            fontSize: '5rem',
            color: '#ffffff',
            textShadow: '0px 4px 15px rgba(0,0,0,0.2)',
            margin: 0
          }}
        >
          Woezor
        </motion.h1>
      </div>
    );
  }

  // 8x8 grid for scatter effect
  const gridSize = 8;
  const grid = Array.from({ length: gridSize * gridSize }, (_, i) => i);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#ffffff', // White background so the logo's white background blends in perfectly
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
        overflow: 'hidden'
      }}
    >
      <motion.div
        initial="initial"
        animate="animate"
        variants={{
          initial: { y: -300, opacity: 0 },
          animate: {
            y: 0,
            opacity: 1,
            transition: {
              duration: 1.5,
              ease: "easeOut"
            }
          }
        }}
        style={{ position: 'relative', width: 160, height: 160, marginBottom: '2rem' }}
      >
        <motion.div
          animate={{ rotate: [0, 0, 360, 360] }}
          transition={{ duration: 4, times: [0, 0.4, 0.8, 1], ease: "easeInOut" }}
          style={{ width: '100%', height: '100%', position: 'relative' }}
        >
          {grid.map((index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const xOffset = col * (100 / gridSize);
            const yOffset = row * (100 / gridSize);
            
            // Scatter directions
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
                      delay: 1, // drops in first, then scatters
                      times: [0, 0.5, 1],
                      ease: "easeInOut"
                    }
                  }
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
                  mixBlendMode: 'multiply' // Helps remove white background artifacts
                }}
              />
            );
          })}
        </motion.div>
      </motion.div>

      {/* Stylish Font Display */}
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
          marginBottom: '2rem'
        }}
      >
        VOTICK <span style={{ color: '#2563eb' }}>✓</span>
      </motion.div>

      {/* Loading Line */}
      <div style={{ width: '250px', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          style={{ width: '100%', height: '100%', background: '#2563eb', borderRadius: '2px' }}
        />
      </div>
    </div>
  );
}
