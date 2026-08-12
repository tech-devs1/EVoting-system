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
  X,
  History
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

  const [electionId, setElectionId] = useState<string | null>(null);

  // Sync election workspace context from URL paths, query parameters, or sessionStorage
  useEffect(() => {
    if (pathname === '/admin/dashboard') {
      setElectionId(null);
      try {
        sessionStorage.removeItem('currentElectionId');
      } catch (e) {}
      return;
    }

    const match = pathname.match(/\/admin\/elections\/([^/]+)/);
    if (match) {
      setElectionId(match[1]);
      try {
        sessionStorage.setItem('currentElectionId', match[1]);
      } catch (e) {}
    } else {
      // Check query parameter
      try {
        const params = new URLSearchParams(window.location.search);
        const qId = params.get('electionId');
        if (qId) {
          setElectionId(qId);
          sessionStorage.setItem('currentElectionId', qId);
        } else {
          const storedId = sessionStorage.getItem('currentElectionId');
          setElectionId(storedId);
        }
      } catch (e) {}
    }
  }, [pathname]);

  const isElectionWorkspace = Boolean(electionId);

  const defaultNavLinks = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Broadcast Center', href: '/admin/messages', icon: Send },
  ];

  const electionNavLinks = electionId ? [
    { label: 'Overview', href: `/admin/elections/${electionId}/dashboard`, icon: LayoutDashboard },
    { label: 'Positions & Candidates', href: `/admin/elections/${electionId}/candidates`, icon: Layers },
    { label: 'Roster & CSV Upload', href: `/admin/elections/${electionId}/voters`, icon: Users },
    { label: 'Broadcast Messages', href: `/admin/elections/${electionId}/messages`, icon: Send },
    { label: 'Live Results', href: `/admin/elections/${electionId}/results`, icon: BarChart3 },
    { label: 'Election System Audit', href: `/admin/elections/${electionId}/audit`, icon: History },
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
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold shadow-md shadow-blue-500/20">
            <ShieldCheck size={22} />
          </div>
          <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            HTU Elect <span className="text-blue-600 dark:text-blue-500">✓</span>
          </span>
        </div>

        {/* Context Back Button if in Per-Election Workspace */}
        {isElectionWorkspace && (
          <Link
            href="/admin/dashboard"
            onClick={() => {
              try {
                sessionStorage.removeItem('currentElectionId');
              } catch (e) {}
              setElectionId(null);
            }}
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold px-3.5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 mb-5 w-full transition-colors"
          >
            <ArrowLeft size={16} /> Back to All Elections
          </Link>
        )}

        {/* Navigation Category: Menu */}
        <div className="mb-6">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-3">
            {isElectionWorkspace ? 'Election Workspace' : 'Menu'}
          </div>
          <nav className="flex flex-col gap-1">
            {activeNavLinks.map((item) => {
              const Icon = item.icon;
              const cleanHref = item.href.split('?')[0];
              const isActive = pathname === cleanHref || (pathname.startsWith(cleanHref) && cleanHref !== '/admin/dashboard');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Navigation Category 2: Miscellaneous */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-3">
            Miscellaneous
          </div>
          <nav className="flex flex-col gap-1">
            <Link
              href={electionId ? `/admin/settings?electionId=${electionId}` : '/admin/settings'}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                pathname === '/admin/settings' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings size={18} className={pathname === '/admin/settings' ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
              <span>Settings</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={logout}
        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 mt-6 w-full transition-colors"
      >
        <LogOut size={18} />
        <span>Log out</span>
      </button>
    </>
  );

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex p-3 md:p-5 gap-4 md:gap-5">
      
      {/* Sidebar rendered ONLY on non-dashboard pages */}
      {!isDashboardPage && (
        <aside className="hidden lg:flex w-64 shrink-0 h-[calc(100vh-2.5rem)] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 flex-col justify-between shadow-sm">
          {renderNavigationContent()}
        </aside>
      )}

      {/* Mobile Drawer Navigation overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex lg:hidden"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-72 h-full bg-white dark:bg-slate-900 p-5 flex flex-col justify-between shadow-2xl overflow-y-auto"
          >
            <div>
              <div className="flex justify-end mb-2">
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                  <X size={22} />
                </button>
              </div>
              {renderNavigationContent()}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-4 md:gap-5 min-w-0 w-full h-[calc(100vh-2.5rem)] overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-between items-center shadow-sm flex-wrap gap-3 shrink-0">
          {/* Left Title & Mobile Hamburger Button */}
          <div className="flex items-center gap-3">
            {!isDashboardPage && (
              <button
                className="lg:hidden w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu size={20} />
              </button>
            )}

            {/* Brand Logo on Dashboard Page */}
            {isDashboardPage && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <ShieldCheck size={22} />
                </div>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  HTU Elect <span className="text-blue-600 dark:text-blue-500">✓</span>
                </span>
              </div>
            )}

            {!isDashboardPage && (
              <>
                <button
                  onClick={() => router.back()}
                  className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {currentTitle}
                </span>
              </>
            )}
          </div>

          {/* Right Action Icons & User Profile Badge */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Pill */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-1">
              <button
                onClick={toggleTheme}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  theme === 'light' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Sun size={15} />
              </button>
              <button
                onClick={toggleTheme}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  theme === 'dark' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Moon size={15} />
              </button>
            </div>

            {/* Notification Bell */}
            <button className="w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <Bell size={18} />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />

            {/* User Profile Badge with Interactive Dropdown */}
            <div className="relative" ref={profileRef}>
              <div 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-2.5 cursor-pointer p-1.5 rounded-2xl transition-colors ${
                  isProfileOpen ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold text-xs shrink-0">
                  {adminName.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{adminName}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Admin</span>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </div>

              {/* Profile Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                  {/* Account Summary */}
                  <div className="pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{user.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 uppercase">
                      <UserCheck size={12} /> {user.role || 'Administrator'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1">
                    <Link
                      href="/admin/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Settings size={16} /> Organization Settings
                    </Link>

                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        toggleTheme();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 w-full text-left transition-colors"
                    >
                      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />} Switch Theme
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        logout();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 w-full text-left transition-colors"
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
        <main className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 flex-1 min-h-0 shadow-sm overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
