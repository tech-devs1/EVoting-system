'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100vw',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'var(--bg-primary, #F8FAFC)',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative gradient mesh background */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%)',
        top: '-10%',
        left: '-10%',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 70%)',
        bottom: '-10%',
        right: '-10%',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: 'var(--bg-secondary, #ffffff)',
        borderRadius: 'var(--radius-xl, 12px)',
        border: '1px solid var(--border-color, #E2E8F0)',
        padding: '3rem 2.25rem',
        boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.05))',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        
        {/* Header Icon */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary-50, #EFF6FF)',
          color: 'var(--color-primary, #2563EB)',
          marginBottom: '1.5rem'
        }}>
          <ShieldCheck size={36} />
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          color: 'var(--text-primary, #0F172A)',
          margin: '0 0 0.75rem 0',
          letterSpacing: '-0.025em'
        }}>
          Password Recovery Deprecated
        </h2>

        {/* Message */}
        <p style={{
          fontSize: 'var(--text-sm, 0.875rem)',
          color: 'var(--text-secondary, #475569)',
          lineHeight: 1.6,
          margin: '0 0 2rem 0'
        }}>
          Password recovery is no longer required. HTU Elect has transitioned exclusively to secure **Google Single Sign-On**.
          <br /><br />
          Since you log in directly using your Google account, you do not need to configure or recover passwords here.
        </p>

        {/* Action Button */}
        <button
          onClick={() => router.push('/login')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.9rem 1.25rem',
            backgroundColor: 'var(--color-primary, #2563EB)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-lg, 10px)',
            fontSize: 'var(--text-sm, 0.875rem)',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.15)',
            transition: 'transform var(--transition-fast, 100ms)'
          }}
        >
          <span>Return to Sign In</span>
          <ArrowRight size={16} />
        </button>

        {/* Footer info decoration */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginTop: '1.75rem',
          color: 'var(--text-muted, #64748B)',
          fontSize: 'var(--text-xs, 0.75rem)'
        }}>
          <Sparkles size={12} style={{ color: 'var(--color-warning, #D97706)' }} />
          <span>Login authorization managed by Google security.</span>
        </div>

      </div>
    </div>
  );
}
