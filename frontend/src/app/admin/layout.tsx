'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Moon,
  Menu,
  X,
  Users,
  FileText
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string>('compssa');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentTenantId(localStorage.getItem('COMPSSA_tenantId') || 'compssa');
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'superadmin') {
      import('@/lib/api').then(({ apiRequest }) => {
        apiRequest<{ status: string; data: { id: string; name: string }[] }>('/superadmin/departments')
          .then(res => {
            if (res.status === 'success') {
              setDepartments(res.data);
            }
          })
          .catch(err => console.error('Failed to load departments for switcher', err));
      });
    }
  }, [user]);

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
    { label: "Executive Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Voter Database", href: "/admin/voters", icon: Users },
    { label: "Manage Elections", href: "/admin/elections", icon: Settings },
    { label: "Live Results", href: "/admin/results", icon: Activity },
    { label: "Report", href: "/admin/reports", icon: FileText },
    { label: "Account Settings", href: "/admin/settings", icon: ShieldCheck }
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
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      {/* Mobile Drawer Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`} id="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Link href="/admin/dashboard" className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldCheck size={24} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
              {user?.name?.replace(' Administrator', '') || 'COMPSSA'} <span style={{ color: 'var(--color-primary)' }}>✓</span>
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
        
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
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
                Administrator Terminal Session
              </span>
            </div>
          </div>
          <div className="topbar-actions" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            {user?.role === 'superadmin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(234, 179, 8, 0.1)', padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-warning)' }}>Dept:</span>
                <select
                  value={currentTenantId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    localStorage.setItem('COMPSSA_tenantId', newId);
                    setCurrentTenantId(newId);
                    window.location.reload();
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>{d.name}</option>
                  ))}
                </select>
                <Link href="/superadmin/dashboard" className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: '11px', textDecoration: 'none', marginLeft: '4px' }}>
                  Exit to Super Admin
                </Link>
              </div>
            )}
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
