'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, LayoutDashboard, Building2, Activity, LogOut, Menu, X } from 'lucide-react';
import '@/app/globals.css';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (!loading && (!user || user.role !== 'superadmin')) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const navItems = [
    { label: 'Overview', icon: <LayoutDashboard size={20} />, href: '/superadmin/dashboard' },
    { label: 'Departments', icon: <Building2 size={20} />, href: '/superadmin/departments' },
    { label: 'System Audit', icon: <Activity size={20} />, href: '/superadmin/audit' },
  ];

  return (
    <div className="admin-layout" style={{ '--color-primary': 'var(--color-warning)', '--color-primary-100': 'var(--color-warning-bg)' } as React.CSSProperties}>
      {/* Mobile Toggle */}
      <button 
        className="mobile-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="auth-logo" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={28} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              SUPER ADMIN
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 'var(--radius-full)', display: 'inline-block' }}>
            VaaS Root Access
          </div>
        </div>

        <nav className="admin-nav">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/superadmin/dashboard');
            return (
              <Link
                key={index}
                href={item.href}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="admin-nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-profile">
            <div className="admin-avatar">
              <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>SA</span>
            </div>
            <div className="admin-info">
              <div className="admin-name">{user.name}</div>
              <div className="admin-role">Super Administrator</div>
            </div>
          </div>
          
          <button onClick={logout} className="btn-logout hover-lift">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {children}
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 90,
          }}
        />
      )}
    </div>
  );
}
