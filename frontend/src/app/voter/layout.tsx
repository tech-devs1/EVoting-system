'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Archive, 
  Search, 
  LogOut, 
  Sun, 
  Moon,
  Menu,
  X,
  Settings,
  KeyRound,
  User
} from 'lucide-react';

export default function VoterLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    { label: "Dashboard", href: "/voter/dashboard", icon: LayoutDashboard },
    { label: "Elections List", href: "/voter/elections", icon: Archive },
    { label: "Verify Vote", href: "/voter/verify", icon: Search }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading voter terminal...</p>
      </div>
    );
  }

  // Fallback profile details if user context properties are empty
  const userName = user?.name || user?.email?.split('@')[0] || "Alex Mercer";

  const currentTitle = navLinks.find(link => pathname.startsWith(link.href))?.label || "Voter Terminal";

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar Navigation */}
      <aside 
        className={`sidebar ${sidebarOpen ? 'open' : ''}`} 
        id="sidebar" 
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <div className="sidebar-header">
          <Link href="/voter/dashboard" className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
        {/* Topbar — hidden on mobile via voter-topbar-hidden class */}
        <header className="topbar voter-topbar-hidden" id="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 var(--container-padding)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button 
              className="menu-toggle-btn" 
              aria-label="Toggle sidebar" 
              onClick={toggleSidebar}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'none', border: 'none', padding: 'var(--space-1)' }}
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="page-title-section">
              <h2 className="page-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{currentTitle}</h2>
              <span className="page-subtitle" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                Secure Voter Balloting Session
              </span>
            </div>
          </div>
          <div className="topbar-actions" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button 
                className="settings-toggle-btn" 
                aria-label="Settings" 
                onClick={() => setSettingsOpen(!settingsOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 'var(--space-1)'
                }}
              >
                <Settings size={18} />
              </button>
              {settingsOpen && (
                <div 
                  className="settings-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + var(--space-2))',
                    right: 0,
                    width: '280px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 50,
                    padding: 'var(--space-4)'
                  }}
                >
                  <div style={{ marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--gradient-primary)',
                        color: 'var(--text-inverse)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: 'var(--text-sm)'
                      }}>
                        <User size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{userName}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{user?.email}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <button 
                      onClick={() => {
                        setSettingsOpen(false);
                        // TODO: Open change password modal
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--text-sm)',
                        textAlign: 'left',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <KeyRound size={16} />
                      <span>Change Password</span>
                    </button>
                    <button 
                      onClick={() => {
                        setSettingsOpen(false);
                        toggleTheme();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--text-sm)',
                        textAlign: 'left',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                      <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                    </button>
                    <div style={{ height: '1px', background: 'var(--border-light)', margin: 'var(--space-2) 0' }}></div>
                    <button 
                      onClick={() => {
                        setSettingsOpen(false);
                        logout();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-danger)',
                        fontSize: 'var(--text-sm)',
                        textAlign: 'left',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="content-area" style={{ flexGrow: 1 }}>
          {children}
        </main>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={toggleSidebar}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 40
          }}
        />
      )}
    </div>
  );
}

