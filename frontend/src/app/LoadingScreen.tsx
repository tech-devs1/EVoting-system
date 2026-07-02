'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function LoadingScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show the splash screen if launched in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                      || (window.navigator as any).standalone 
                      || document.referrer.includes('android-app://');
    
    if (!isStandalone) {
      return;
    }

    setVisible(true);

    // Hide splash screen after exactly 5 seconds
    const timer = setTimeout(() => {
      setVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  // We split the logo into a grid of squares to 'scatter' them
  const grid = [];
  const gridSize = 10; // 10x10 grid
  for (let i = 0; i < gridSize * gridSize; i++) {
    grid.push(i);
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0f172a', // dark theme background
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
          initial: { y: -500, scale: 0.5 },
          animate: {
            y: 0,
            scale: 1,
            transition: {
              type: 'spring',
              stiffness: 200,
              damping: 10,
              duration: 1.5,
              delay: 0.5
            }
          }
        }}
        style={{ position: 'relative', width: 200, height: 200 }}
      >
        {/* We use a grid of divs that look like the image, and then they shatter */}
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {grid.map((index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const xOffset = col * (100 / gridSize);
            const yOffset = row * (100 / gridSize);
            
            // Random scatter position
            const randX = (Math.random() - 0.5) * 800;
            const randY = (Math.random() - 0.5) * 800;
            const randRot = (Math.random() - 0.5) * 720;

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
                    opacity: [1, 0, 1],
                    transition: {
                      duration: 2.5,
                      delay: 2.0, // starts shattering at 2s
                      times: [0, 0.5, 1], // scatter out, then come back
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
                }}
              />
            );
          })}
        </div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 2, delay: 2.2, repeat: 1 }}
        style={{ marginTop: '40px', color: '#fff', fontSize: '24px', fontWeight: 'bold', fontFamily: 'sans-serif' }}
      >
        Votick Security Check...
      </motion.div>
    </div>
  );
}
