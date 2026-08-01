'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Building2, 
  Activity, 
  LogOut, 
  Sun, 
  Moon,
  Menu,
  X
} from 'lucide-react';
import '@/app/globals.css';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (!loading && (!user || user.role !== 'superadmin')) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Close sidebar on navigation change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

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
    { label: "Overview", href: "/superadmin/dashboard", icon: LayoutDashboard },
    { label: "Departments", href: "/superadmin/departments", icon: Building2 },
    { label: "System Audit", href: "/superadmin/audit", icon: Activity }
  ];

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading super administrator terminal...</p>
      </div>
    );
  }

  const currentTitle = navLinks.find(link => pathname.startsWith(link.href))?.label || "Super Admin Console";

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative', '--color-primary': 'var(--color-warning)' } as React.CSSProperties}>
      {/* Mobile Drawer Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`} id="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Link href="/superadmin/dashboard" className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldCheck size={24} style={{ color: 'var(--color-warning)' }} />
            <span style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
              SUPER ADMIN
            </span>
          </Link>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="theme-toggle-btn mobile-only-close"
            style={{ display: 'none', border: 'none', background: 'none', padding: '4px', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav" style={{ flexGrow: 1 }}>
          {navLinks.map(link => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/superadmin/dashboard');
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
        
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              SA
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Root Access</div>
            </div>
          </div>
          <button 
            onClick={logout}
            className="sidebar-link" 
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-danger)' }}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>

      </aside>

      {/* Main Content Frame */}
      <div className="main-wrapper" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <header className="topbar" id="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 var(--container-padding)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="theme-toggle-btn mobile-menu-btn"
              style={{ display: 'none', cursor: 'pointer' }}
              aria-label="Open Sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="page-title-section">
              <h2 className="page-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{currentTitle}</h2>
              <span className="page-subtitle" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                VaaS Root Console
              </span>
            </div>
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
          const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/superadmin/dashboard');
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
