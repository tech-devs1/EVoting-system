'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Layers, 
  Users, 
  BarChart3, 
  FileText, 
  ShieldAlert, 
  Settings, 
  LogOut, 
  Sun, 
  Moon, 
  Bell, 
  ChevronLeft,
  ChevronDown,
  ArrowLeft,
  UserCheck,
  Menu,
  Send,
  X
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Auth Guard
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'voter') {
        router.push('/voter/dashboard');
      }
    }
  }, [user, loading, router]);

  // Profile Dropdown Outside Click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Check if main dashboard (No sidebar requested for /admin/dashboard)
  const isDashboardPage = pathname === '/admin/dashboard';

  // Detect Per-Election Workspace Context
  const electionMatch = pathname.match(/\/admin\/elections\/([^/]+)/);
  const isElectionWorkspace = Boolean(electionMatch);
  const electionId = electionMatch ? electionMatch[1] : null;

  const defaultNavLinks = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Positions & Candidates', href: '/admin/elections', icon: Layers },
    { label: 'Voters Roster', href: '/admin/voters', icon: Users },
    { label: 'Broadcast Center', href: '/admin/messages', icon: Send },
    { label: 'Live Results', href: '/admin/results', icon: BarChart3 },
    { label: 'Audit Ledger', href: '/admin/audit', icon: FileText },
    { label: 'Access Security', href: '/admin/fraud', icon: ShieldAlert },
  ];

  const electionNavLinks = electionId ? [
    { label: 'Overview', href: `/admin/elections/${electionId}/dashboard`, icon: LayoutDashboard },
    { label: 'Positions & Candidates', href: `/admin/elections/${electionId}/candidates`, icon: Layers },
    { label: 'Roster & CSV Upload', href: `/admin/elections/${electionId}/voters`, icon: Users },
    { label: 'Broadcast Messages', href: `/admin/elections/${electionId}/messages`, icon: Send },
    { label: 'Live Results', href: `/admin/elections/${electionId}/results`, icon: BarChart3 },
    { label: '360° Audit Ledger', href: `/admin/elections/${electionId}/audit`, icon: FileText },
    { label: 'Access Security', href: `/admin/elections/${electionId}/fraud`, icon: ShieldAlert },
  ] : defaultNavLinks;

  const activeNavLinks = isElectionWorkspace ? electionNavLinks : defaultNavLinks;

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9' }}>
        <p style={{ color: '#64748B', fontWeight: 500 }}>Loading Justadmin terminal...</p>
      </div>
    );
  }

  const currentTitle = activeNavLinks.find(link => pathname === link.href || pathname.startsWith(link.href))?.label || 'Dashboard';
  const adminName = user.name || 'Electoral Admin';

  const renderNavigationContent = () => (
    <>
      <div>
        {/* Logo Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem', paddingLeft: '0.5rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
          }}>
            <ShieldCheck size={24} />
          </div>
          <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>
            HTU Elect <span style={{ color: '#2563EB' }}>✓</span>
          </span>
        </div>

        {/* Context Back Button if in Per-Election Workspace */}
        {isElectionWorkspace && (
          <Link
            href="/admin/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#2563EB',
              fontSize: '0.85rem',
              fontWeight: 700,
              textDecoration: 'none',
              padding: '0.6rem 0.85rem',
              borderRadius: '12px',
              backgroundColor: '#EFF6FF',
              marginBottom: '1.25rem',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            <ArrowLeft size={16} /> Back to All Elections
          </Link>
        )}

        {/* Navigation Category: Menu */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', paddingLeft: '0.75rem' }}>
            {isElectionWorkspace ? 'Election Workspace' : 'Menu'}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {activeNavLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/admin/dashboard');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 700 : 500,
                    textDecoration: 'none',
                    backgroundColor: isActive ? '#2563EB' : 'transparent',
                    color: isActive ? '#FFFFFF' : '#64748B',
                    boxShadow: isActive ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Icon size={19} style={{ color: isActive ? '#FFFFFF' : '#64748B' }} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Navigation Category 2: Miscellaneous */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', paddingLeft: '0.75rem' }}>
            Miscellaneous
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Link
              href="/admin/settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.85rem 1rem',
                borderRadius: '16px',
                fontSize: '0.9rem',
                fontWeight: pathname === '/admin/settings' ? 700 : 500,
                textDecoration: 'none',
                backgroundColor: pathname === '/admin/settings' ? '#2563EB' : 'transparent',
                color: pathname === '/admin/settings' ? '#FFFFFF' : '#64748B',
                boxShadow: pathname === '/admin/settings' ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <Settings size={19} style={{ color: pathname === '/admin/settings' ? '#FFFFFF' : '#64748B' }} />
              <span>Settings</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={logout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '0.85rem 1rem',
          borderRadius: '16px',
          fontSize: '0.9rem',
          fontWeight: 600,
          color: '#DC2626',
          backgroundColor: '#FEF2F2',
          border: 'none',
          cursor: 'pointer',
          marginTop: '1.5rem',
          width: '100%',
          transition: 'all 0.2s ease'
        }}
      >
        <LogOut size={19} />
        <span>Log out</span>
      </button>
    </>
  );

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F4F6F9',
      color: '#0F172A',
      fontFamily: 'var(--font-body, "Plus Jakarta Sans", system-ui, sans-serif)',
      display: 'flex',
      padding: '1.25rem',
      gap: '1.25rem',
      boxSizing: 'border-box'
    }} className="admin-layout-container">
      
      {/* Sidebar rendered ONLY on non-dashboard pages */}
      {!isDashboardPage && (
        <aside className="admin-desktop-sidebar" style={{
          width: '260px',
          flexShrink: 0,
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          padding: '1.5rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.03)'
        }}>
          {renderNavigationContent()}
        </aside>
      )}

      {/* Mobile Drawer Navigation overlay (when toggled via hamburger menu) */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)} 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{
              width: '280px',
              height: '100%',
              backgroundColor: '#FFFFFF',
              padding: '1.5rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflowY: 'auto'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                  <X size={24} />
                </button>
              </div>
              {renderNavigationContent()}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0, width: '100%' }}>
        {/* Top Navigation Bar */}
        <header style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.03)',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          {/* Left Title & Mobile Hamburger Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {!isDashboardPage && (
              <button
                className="admin-mobile-menu-btn"
                onClick={() => setIsMobileMenuOpen(true)}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  backgroundColor: '#F1F5F9',
                  color: '#0F172A',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Menu size={20} />
              </button>
            )}

            {/* Brand Logo on Dashboard Page */}
            {isDashboardPage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  backgroundColor: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF'
                }}>
                  <ShieldCheck size={22} />
                </div>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                  HTU Elect <span style={{ color: '#2563EB' }}>✓</span>
                </span>
              </div>
            )}

            {!isDashboardPage && (
              <>
                <button
                  onClick={() => router.back()}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>
                  {currentTitle}
                </span>
              </>
            )}
          </div>

          {/* Right Action Icons & User Profile Badge with Interactive Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F1F5F9',
              borderRadius: '9999px',
              padding: '0.25rem'
            }}>
              <button
                onClick={toggleTheme}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: theme === 'light' ? '#2563EB' : 'transparent',
                  color: theme === 'light' ? '#FFFFFF' : '#64748B',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Sun size={16} />
              </button>
              <button
                onClick={toggleTheme}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: theme === 'dark' ? '#2563EB' : 'transparent',
                  color: theme === 'dark' ? '#FFFFFF' : '#64748B',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Moon size={16} />
              </button>
            </div>

            {/* Notification Bell */}
            <button style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748B',
              cursor: 'pointer'
            }}>
              <Bell size={18} />
            </button>

            {/* Divider */}
            <div style={{ width: '1px', height: '24px', backgroundColor: '#E2E8F0' }} />

            {/* User Profile Badge with Interactive Dropdown */}
            <div style={{ position: 'relative' }} ref={profileRef}>
              <div 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.65rem', 
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '16px',
                  backgroundColor: isProfileOpen ? '#F1F5F9' : 'transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#DBEAFE',
                  color: '#1D4ED8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  flexShrink: 0
                }}>
                  {adminName.substring(0, 2).toUpperCase()}
                </div>
                <div className="admin-profile-meta" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>{adminName}</span>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Admin</span>
                </div>
                <ChevronDown size={16} style={{ color: '#94A3B8', transform: isProfileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
              </div>

              {/* Profile Dropdown Menu */}
              {isProfileOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 12px)',
                  right: 0,
                  width: '260px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '20px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.15)',
                  padding: '1.25rem',
                  zIndex: 1000
                }}>
                  {/* Account Summary */}
                  <div style={{ paddingBottom: '0.85rem', marginBottom: '0.85rem', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>{user.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', wordBreak: 'break-all' }}>{user.email}</div>
                    <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#2563EB', textTransform: 'uppercase' }}>
                      <UserCheck size={12} /> {user.role || 'Administrator'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <Link
                      href="/admin/settings"
                      onClick={() => setIsProfileOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#475569',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Settings size={16} /> Organization Settings
                    </Link>

                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        toggleTheme();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#475569',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />} Switch Theme
                    </button>

                    <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '4px 0' }} />

                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        logout();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#DC2626',
                        backgroundColor: '#FEF2F2',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <LogOut size={16} /> Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Container Frame */}
        <main className="admin-main-content" style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          padding: '2rem',
          flex: 1,
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.03)',
          overflowY: 'auto'
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
