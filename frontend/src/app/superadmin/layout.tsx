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
  Bell, 
  ChevronLeft,
  ChevronDown
} from 'lucide-react';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Auth Guard
  useEffect(() => {
    if (!loading && (!user || user.role !== 'superadmin')) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const navLinks = [
    { label: 'Overview', href: '/superadmin/dashboard', icon: LayoutDashboard },
    { label: 'Departments & Orgs', href: '/superadmin/departments', icon: Building2 },
    { label: 'System Audit Logs', href: '/superadmin/audit', icon: Activity }
  ];

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9' }}>
        <p style={{ color: '#64748B', fontWeight: 500 }}>Loading Superadmin Console...</p>
      </div>
    );
  }

  const currentTitle = navLinks.find(link => pathname.startsWith(link.href))?.label || 'Super Admin Console';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F4F6F9',
      color: '#0F172A',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
      display: 'flex',
      padding: '1.25rem',
      gap: '1.25rem',
      boxSizing: 'border-box'
    }}>
      {/* Floating Justadmin Left Navigation Sidebar */}
      <aside style={{
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
        <div>
          {/* Logo Brand Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', paddingLeft: '0.5rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
            }}>
              <ShieldCheck size={24} />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>
              Superadmin <span style={{ color: '#7C3AED' }}>✓</span>
            </span>
          </div>

          {/* Navigation Category 1: Root Menu */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', paddingLeft: '0.75rem' }}>
              Root Controls
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/superadmin/dashboard');

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
                      backgroundColor: isActive ? '#7C3AED' : 'transparent',
                      color: isActive ? '#FFFFFF' : '#64748B',
                      boxShadow: isActive ? '0 4px 14px rgba(124, 58, 237, 0.35)' : 'none',
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
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
        {/* Top Navigation Bar */}
        <header style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.03)'
        }}>
          {/* Left Title & Back Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => router.back()}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#7C3AED',
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
          </div>

          {/* Right Action Icons & User Profile Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                  backgroundColor: theme === 'light' ? '#7C3AED' : 'transparent',
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
                  backgroundColor: theme === 'dark' ? '#7C3AED' : 'transparent',
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

            {/* User Profile Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#EDE9FE',
                color: '#7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.95rem'
              }}>
                SA
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>{user.name}</span>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Superadmin</span>
              </div>
              <ChevronDown size={16} style={{ color: '#94A3B8' }} />
            </div>
          </div>
        </header>

        {/* Content Container Frame */}
        <main style={{
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
