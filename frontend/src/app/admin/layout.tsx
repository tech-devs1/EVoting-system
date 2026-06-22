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

  useEffect(() => {
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
            <span>VoteTrust <strong style={{ color: 'var(--color-primary)' }}>AI</strong></span>
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
        <div className="sidebar-footer">
          <div className="user-profile-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <div className="user-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              SA
            </div>
            <div className="user-info" style={{ flexGrow: 1, minWidth: 0 }}>
              <div className="user-name truncate" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>System Administrator</div>
              <div className="user-role truncate" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Audit Cleared</div>
            </div>
            <button onClick={logout} style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }} title="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
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
        <main className="content-area" style={{ flexGrow: 1, padding: 'var(--container-padding)' }}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-nav" id="mobile-navigation-bar" style={{ display: 'flex', justifyContent: 'space-around', position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-glass)', borderTop: '1px solid var(--border-color)', height: 'var(--bottom-nav-height)' }}>
        {navLinks.map(link => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link href={link.href} className={`mobile-nav-link ${isActive ? 'active' : ''}`} key={link.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} />
              <span style={{ fontSize: '10px', marginTop: '4px' }}>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
