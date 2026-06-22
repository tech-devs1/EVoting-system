'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Lock, 
  Sun, 
  Moon, 
  CircleDot, 
  CheckCircle, 
  Fingerprint, 
  ShieldAlert, 
  UserX, 
  BarChart3, 
  Eye, 
  Cpu, 
  Database 
} from 'lucide-react';

export default function LandingPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Load theme from localStorage or document default
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const currentTheme = savedTheme || 'light';
    setTheme(currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  return (
    <div className="landing-container animate-page-enter">
      {/* Top Sticky Navigation */}
      <nav style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: 'var(--space-4) var(--space-8)', 
        background: 'var(--bg-glass)', 
        backdropFilter: 'blur(10px)', 
        borderBottom: '1px solid var(--border-color)', 
        position: 'sticky', 
        top: 0, 
        zIndex: 'var(--z-sticky)'
      }}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ShieldCheck size={24} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>
            VoteTrust <strong style={{ color: 'var(--color-primary)' }}>AI</strong>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
          <button 
            className="theme-toggle-btn" 
            aria-label="Toggle Light/Dark Theme" 
            onClick={toggleTheme}
            style={{ padding: '8px', cursor: 'pointer', borderRadius: '50%' }}
          >
            {theme === 'light' ? <Moon size={20} className="moon-icon" /> : <Sun size={20} className="sun-icon" />}
          </button>
          <Link href="/login" className="btn btn-secondary btn-sm">Sign In</Link>
          <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-mesh"></div>
        <div className="container hero-grid">
          <div className="hero-content">
            <span className="hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} /> End-to-End Cryptographic Security
            </span>
            <h1 className="hero-title">
              Secure Digital Elections Powered by <span className="gradient-text">AI & Cryptography</span>
            </h1>
            <p className="hero-subtitle">
              Transparent, Tamper-Proof, and Trusted E-Voting for Universities and Enterprise Organizations.
            </p>
            <div className="hero-ctas">
              <Link href="/login" className="btn btn-primary btn-lg hover-lift">Vote Now</Link>
              <a href="#features" className="btn btn-outline btn-lg">Explore Features</a>
            </div>
          </div>
          <div className="hero-illustration">
            <div className="illustration-bg"></div>
            {/* Glassmorphism dashboard mockup element */}
            <div className="glass-card-strong illustration-card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <CircleDot size={14} className="animate-pulse" /> LIVE election
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Turnout: 84.6%</span>
              </div>
              <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>HTU presidential candidate count</h3>
              
              {/* Micro chart bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>
                    <span>Elena Rostova</span>
                    <span>52%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '52%', height: '100%', background: 'var(--color-primary)' }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>
                    <span>Marcus Vance</span>
                    <span>48%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '48%', height: '100%', background: 'var(--color-purple)' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating verification widgets */}
            <div className="glass-card-strong floating-widget widget-top-left" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', borderColor: 'rgba(34, 197, 94, 0.4)' }}>
              <CheckCircle size={18} className="text-success" />
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>Vote Hash Verified</p>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>SHA-256 Valid</span>
              </div>
            </div>

            <div className="glass-card-strong floating-widget widget-bottom-right" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', borderColor: 'rgba(124, 58, 237, 0.4)' }}>
              <Fingerprint size={18} className="text-info" />
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>Voter Anonymized</p>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Zero-Knowledge Proof</span>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Features grid section */}
      <section id="features" className="section container">
        <div className="section-header">
          <span className="section-tag">Security & Protection</span>
          <h2 className="section-title">Designed for Ultimate Integrity</h2>
          <p className="section-subtitle">A modern civic ledger built on top-tier cryptographic protocols and advanced monitoring logic.</p>
        </div>

        <div className="features-grid">
          <div className="card card-hover feature-card">
            <div className="feature-icon-wrapper">
              <ShieldAlert />
            </div>
            <h3 className="feature-title">Secure Authentication</h3>
            <p className="feature-desc">Single sign-on binding, strict biometric credentials validation, and one-time MFA codes protect voting lines.</p>
          </div>

          <div className="card card-hover feature-card">
            <div className="feature-icon-wrapper">
              <UserX />
            </div>
            <h3 className="feature-title">Anonymous Voting</h3>
            <p className="feature-desc">Homomorphic encryption protects ballot options selection, making sure candidate choice is hidden from database keys.</p>
          </div>

          <div className="card card-hover feature-card">
            <div className="feature-icon-wrapper">
              <BarChart3 />
            </div>
            <h3 className="feature-title">Real-Time Results</h3>
            <p className="feature-desc">Direct result summaries compile on audit chain update ticks, offering dynamic, trustable election charts instantly.</p>
          </div>

          <div className="card card-hover feature-card">
            <div className="feature-icon-wrapper">
              <Eye />
            </div>
            <h3 className="feature-title">Fraud Detection</h3>
            <p className="feature-desc">AI monitors login session anomalies, threat levels, browser fingerprints, and multiple identity queries.</p>
          </div>

          <div className="card card-hover feature-card">
            <div className="feature-icon-wrapper">
              <Cpu />
            </div>
            <h3 className="feature-title">Audit Verification</h3>
            <p className="feature-desc">Verify your ballot transaction ID matches the chain hash state, ensuring your vote was accurately stored.</p>
          </div>

          <div className="card card-hover feature-card">
            <div className="feature-icon-wrapper">
              <Database />
            </div>
            <h3 className="feature-title">SHA-256 Audit Chain</h3>
            <p className="feature-desc">A back-linked cryptographic ledger enforces records preservation. Broken chains trigger threat scores instantly.</p>
          </div>
        </div>
      </section>

      {/* How it works timeline */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Simplifying E-voting</span>
            <h2 className="section-title">Step-by-Step E-Voting Journey</h2>
            <p className="section-subtitle">Our 3-click voting process fits smoothly into any browser or smartphone layout.</p>
          </div>

          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-node"></div>
              <div className="timeline-step">Step 1</div>
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Register Account</h3>
              <p style={{ fontSize: 'var(--text-sm)' }}>Provide credentials like student identity card, matching details, and set passphrase key.</p>
            </div>

            <div className="timeline-item">
              <div className="timeline-node"></div>
              <div className="timeline-step">Step 2</div>
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Verify Identity</h3>
              <p style={{ fontSize: 'var(--text-sm)' }}>Confirm identity keys via verification link or multi-factor code confirmation codes.</p>
            </div>

            <div className="timeline-item">
              <div className="timeline-node"></div>
              <div className="timeline-step">Step 3</div>
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Cast Ballot</h3>
              <p style={{ fontSize: 'var(--text-sm)' }}>Browse candidates, compare election manifestos, and securely submit choices.</p>
            </div>

            <div className="timeline-item">
              <div className="timeline-node"></div>
              <div className="timeline-step">Step 4</div>
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Verify Vote</h3>
              <p style={{ fontSize: 'var(--text-sm)' }}>Download cryptographic verification receipt and lookup registration records on hash explorer.</p>
            </div>

            <div className="timeline-item">
              <div className="timeline-node"></div>
              <div className="timeline-step">Step 5</div>
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>View Results</h3>
              <p style={{ fontSize: 'var(--text-sm)' }}>Wait for election termination to review certified analytics breakdown tables.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section container">
        <div className="section-header">
          <span className="section-tag">Organization Testimonials</span>
          <h2 className="section-title">Trusted by Academic Leaders</h2>
        </div>

        <div className="testimonials-slider">
          <div className="testimonial-track">
            <div className="testimonial-slide">
              <div className="glass-card text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <p style={{ fontSize: 'var(--text-base)', fontStyle: 'italic', marginBottom: 'var(--space-4)' }}>
                  &ldquo;VoteTrust AI redefined our student elections. Over 88% voter turnout was achieved with absolute confidence in election integrity.&rdquo;
                </p>
                <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>Prof. Evelyn Carter</h4>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Dean of Student Affairs, HTU</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ShieldCheck size={24} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>VoteTrust AI</span>
            </div>
            <p className="footer-desc">
              Next-generation secure, transparent digital voting technology built for institutions worldwide.
            </p>
          </div>
          <div className="footer-column">
            <h4 className="footer-col-title">Platform</h4>
            <div className="footer-links">
              <Link href="/login" className="footer-link">Vote Now</Link>
              <a href="#features" className="footer-link">Security Specs</a>
              <Link href="/" className="footer-link">Institutional Pricing</Link>
            </div>
          </div>
          <div className="footer-column">
            <h4 className="footer-col-title">Support</h4>
            <div className="footer-links">
              <Link href="/" className="footer-link">Audit Guide</Link>
              <Link href="/" className="footer-link">Help Desk</Link>
              <Link href="/" className="footer-link">System Status</Link>
            </div>
          </div>
          <div className="footer-column">
            <h4 className="footer-col-title">Legal</h4>
            <div className="footer-links">
              <Link href="/" className="footer-link">Privacy Policy</Link>
              <Link href="/" className="footer-link">Terms of Service</Link>
              <Link href="/" className="footer-link">Voter Charter</Link>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>&copy; 2026 VoteTrust AI. All rights reserved.</span>
          <span>Protected by AES-256 & SHA-256 Cryptography</span>
        </div>
      </footer>
    </div>
  );
}
