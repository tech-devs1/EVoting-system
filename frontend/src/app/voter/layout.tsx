'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  User,
  Lock,
  Eye,
  EyeOff,
  X as CloseIcon
} from 'lucide-react';

export default function VoterLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

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

  // Close settings dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };

    if (settingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [settingsOpen]);

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
            <div style={{ position: 'relative' }} ref={settingsRef}>
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
                        setChangePasswordOpen(true);
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

      {/* Change Password Modal */}
      {changePasswordOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)'
          }}
          onClick={() => setChangePasswordOpen(false)}
        >
          <div 
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              maxWidth: '450px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>Change Password</h3>
              <button 
                onClick={() => setChangePasswordOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <CloseIcon size={20} />
              </button>
            </div>
            <ChangePasswordForm onClose={() => setChangePasswordOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

// Change Password Form Component
function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    // Password validation: minimum 8 chars, 1 uppercase, 1 lowercase, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setError('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.');
      return;
    }

    setLoading(true);
    try {
      // TODO: Call API to change password
      // await apiRequest('/auth/change-password', 'POST', {
      //   currentPassword,
      //   newPassword
      // });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4) auto'
        }}>
          <KeyRound size={30} />
        </div>
        <h4 style={{ margin: 0, marginBottom: 'var(--space-2)' }}>Password Changed</h4>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Your password has been successfully updated.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--text-sm)',
          background: 'var(--color-danger-bg)',
          color: 'var(--color-danger)',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          {error}
        </div>
      )}
      
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
          Current Password
        </label>
        <div style={{ position: 'relative' }}>
          <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            placeholder="Enter current password"
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-3) var(--space-3) 40px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)'
            }}
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
          New Password
        </label>
        <div style={{ position: 'relative' }}>
          <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="Enter new password"
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-3) var(--space-3) 40px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)'
            }}
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
          Confirm New Password
        </label>
        <div style={{ position: 'relative' }}>
          <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm new password"
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-3) var(--space-3) 40px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)'
            }}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1,
            padding: 'var(--space-3)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: 500
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          style={{
            flex: 1,
            padding: 'var(--space-3)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary)',
            color: 'var(--text-inverse)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Updating...' : 'Change Password'}
        </button>
      </div>
    </form>
  );
}

