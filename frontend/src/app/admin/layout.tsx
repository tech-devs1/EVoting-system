'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Settings, 
  Activity, 
  ShieldAlert, 
  Database, 
  BarChart3, 
  LogOut, 
  Sun, 
  Moon 
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { logout, loading } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only run on client side after mount
    if (!mounted) return;

    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const currentTheme = savedTheme || 'light';
    setTheme(currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [mounted]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const navLinks = [
    { label: "Executive Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Manage Elections", href: "/admin/elections", icon: Settings },
    { label: "Live Results", href: "/admin/results", icon: Activity },
    { label: "Fraud Monitor", href: "/admin/fraud", icon: ShieldAlert },
    { label: "Audit Ledger", href: "/admin/audit", icon: Database },
    { label: "Analytics Module", href: "/admin/analytics", icon: BarChart3 }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading administrator terminal...</p>
      </div>
    );
  }

  const currentTitle = navLinks.find(link => pathname.startsWith(link.href))?.label || "Admin Console";

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar Navigation */}
      <aside className="sidebar" id="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-header">
          <Link href="/admin/dashboard" className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldCheck size={24} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>Votick <span style={{ color: 'var(--color-primary)' }}>✓</span></span>
          </Link>
        </div>
        <nav className="sidebar-nav" style={{ flexGrow: 1 }}>
          {navLinks.map(link => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link 
                href={link.href} 
                className={`sidebar-link ${isActive ? 'active' : ''}`} 
                key={link.href}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Main Content Frame */}
      <div className="main-wrapper" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <header className="topbar" id="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 var(--container-padding)' }}>
          <div className="page-title-section">
            <h2 className="page-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{currentTitle}</h2>
            <span className="page-subtitle" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              Administrator Terminal Session
            </span>
          </div>
          <div className="topbar-actions" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <button className="theme-toggle-btn" aria-label="Toggle Light/Dark Theme" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="content-area" style={{ flexGrow: 1 }}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-nav" id="mobile-navigation-bar">
        {navLinks.map(link => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link href={link.href} className={`mobile-nav-link ${isActive ? 'active' : ''}`} key={link.href}>
              <Icon size={18} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
