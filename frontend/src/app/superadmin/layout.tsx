'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  ChevronDown,
  UserCheck
} from 'lucide-react';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Auth Guard
  useEffect(() => {
    if (!loading && (!user || user.role !== 'superadmin')) {
      router.push('/login');
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
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium">
        <p className="text-sm">Loading Superadmin Console...</p>
      </div>
    );
  }

  const currentTitle = navLinks.find(link => pathname.startsWith(link.href))?.label || 'Super Admin Console';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex p-3 md:p-5 gap-4 md:gap-5">
      {/* Floating Justadmin Left Navigation Sidebar */}
      <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shadow-sm">
        <div>
          {/* Logo Brand Header */}
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <ShieldCheck size={24} />
            </div>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Superadmin <span className="text-purple-600 dark:text-purple-400">✓</span>
            </span>
          </div>

          {/* Navigation Category 1: Root Menu */}
          <div className="mb-6">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-3">
              Root Controls
            </div>
            <nav className="flex flex-col gap-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/superadmin/dashboard');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive 
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 font-bold' 
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
        </div>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 mt-6 w-full transition-colors"
        >
          <LogOut size={18} />
          <span>Log out</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-4 md:gap-5 min-w-0">
        {/* Top Navigation Bar */}
        <header className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-between items-center shadow-sm shrink-0">
          {/* Left Title & Back Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              {currentTitle}
            </span>
          </div>

          {/* Right Action Icons & User Profile Badge */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle Pill */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-1">
              <button
                onClick={toggleTheme}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  theme === 'light' ? 'bg-purple-600 text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Sun size={15} />
              </button>
              <button
                onClick={toggleTheme}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  theme === 'dark' ? 'bg-purple-600 text-white' : 'text-slate-500 dark:text-slate-400'
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

            {/* User Profile Badge with Dropdown */}
            <div className="relative" ref={profileRef}>
              <div 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-3 cursor-pointer p-1.5 rounded-2xl transition-colors ${
                  isProfileOpen ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-extrabold text-xs">
                  SA
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{user.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Superadmin</span>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </div>

              {/* Profile Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{user.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 uppercase">
                      <UserCheck size={12} /> Root Superadmin
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
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
        <main className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 flex-1 shadow-sm overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
