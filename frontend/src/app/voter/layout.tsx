'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { hardNavigate } from '@/lib/navigation';
import MobileTabBar from '@/components/MobileTabBar';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Archive, 
  BarChart3,
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
  const [mounted, setMounted] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const [pushSupported, setPushSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushSupported(true);
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      if (typeof Notification.requestPermission === 'function') {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            if (registration && registration.showNotification) {
              registration.showNotification('HTU Elect ✓', {
                body: 'Push notifications successfully enabled! Stay tuned for live updates.',
                icon: '/assets/logo.png',
                badge: '/assets/logo.png',
                vibrate: [100, 50, 100],
              } as any);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to request notification permission', err);
    }
  };

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth Guard — hard navigation so iOS Safari / static cPanel exports always land.
  useEffect(() => {
    if (!loading) {
      if (!user) {
        const t = setTimeout(() => hardNavigate('/login'), 100);
        return () => clearTimeout(t);
      } else if (user.role === 'admin') {
        const t = setTimeout(() => hardNavigate('/admin/dashboard'), 100);
        return () => clearTimeout(t);
      } else if (user.role === 'superadmin') {
        const t = setTimeout(() => hardNavigate('/superadmin/dashboard'), 100);
        return () => clearTimeout(t);
      }
    }
  }, [user, loading]);

  useEffect(() => {
    // Only run on client side after mount
    if (!mounted) return;

    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const currentTheme = savedTheme || 'light';
    setTheme(currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [mounted]);

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

  // Close sidebar on clicking/tapping outside (mobile & desktop)
  useEffect(() => {
    const handleOutsideClickOrTouch = (event: MouseEvent | TouchEvent) => {
      if (
        sidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        const toggleBtn = document.querySelector('.menu-toggle-btn');
        if (toggleBtn && toggleBtn.contains(event.target as Node)) return;
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener('mousedown', handleOutsideClickOrTouch);
      document.addEventListener('touchstart', handleOutsideClickOrTouch);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClickOrTouch);
      document.removeEventListener('touchstart', handleOutsideClickOrTouch);
    };
  }, [sidebarOpen]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const navLinks = [
    { label: "Dashboard", href: "/voter/dashboard", icon: LayoutDashboard },
    { label: "Elections List", href: "/voter/elections", icon: Archive }
  ];

  // Native-app style bottom tabs (mobile only).
  const mobileTabs = [
    { label: "Home", href: "/voter/dashboard", icon: LayoutDashboard },
    { label: "Elections", href: "/voter/elections", icon: Archive },
    { label: "Results", href: "/voter/elections/results", icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
        <p className="font-medium text-sm">Loading voter terminal...</p>
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
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sidebar Navigation */}
      <aside 
        ref={sidebarRef}
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        id="sidebar"
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <Link href="/voter/dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2.5 text-slate-900 dark:text-white font-extrabold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
              <img src="/assets/logo.png" alt="HTU Elect Logo" className="w-full h-full object-contain" />
            </div>
            <span>HTU Elect <span className="text-blue-600 dark:text-blue-500">✓</span></span>
          </Link>
        </div>
        <nav className="flex flex-col gap-1.5 p-4 flex-1 overflow-y-auto">
          {navLinks.map(link => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link 
                href={link.href} 
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`} 
                key={link.href}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Frame */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              className="hidden md:flex p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer touch-manipulation menu-toggle-btn"
              aria-label="Toggle sidebar" 
              onClick={toggleSidebar}
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-tight">{currentTitle}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline-block">
                Secure Voter Balloting Session
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* PWA Notifications pill */}
            {pushSupported && (
              <button
                onClick={requestNotificationPermission}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  notificationPermission === 'granted'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
                    : notificationPermission === 'denied'
                    ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                }`}
                title={
                  notificationPermission === 'granted'
                    ? 'Notifications active!'
                    : notificationPermission === 'denied'
                    ? 'Notifications blocked. Check browser settings.'
                    : 'Click to enable live election alerts.'
                }
              >
                <span className="text-sm">🔔</span>
                <span className="hidden sm:inline">
                  {notificationPermission === 'granted' ? 'Active' : notificationPermission === 'denied' ? 'Blocked' : 'Enable Alerts'}
                </span>
              </button>
            )}

            <div className="relative" ref={settingsRef}>
              <button 
                className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors" 
                aria-label="Settings" 
                onClick={() => setSettingsOpen(!settingsOpen)}
              >
                <Settings size={20} />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                        <User size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">{userName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => {
                        setSettingsOpen(false);
                        window.dispatchEvent(new CustomEvent('open-pwa-install'));
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 w-full text-left transition-colors"
                    >
                      <span className="text-blue-600 dark:text-blue-400 text-base">📲</span>
                      <span>Install App Guide</span>
                    </button>
                    <button 
                      onClick={() => {
                        setSettingsOpen(false);
                        setChangePasswordOpen(true);
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 w-full text-left transition-colors"
                    >
                      <KeyRound size={16} />
                      <span>Change Password</span>
                    </button>
                    <button 
                      onClick={() => {
                        setSettingsOpen(false);
                        toggleTheme();
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 w-full text-left transition-colors"
                    >
                      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                      <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                    <button 
                      onClick={() => {
                        setSettingsOpen(false);
                        logout();
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 w-full text-left transition-colors"
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
        <main className="flex-1 p-3 pb-24 sm:p-6 md:p-8 md:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar (native-app style, hidden on md+) */}
      <MobileTabBar tabs={mobileTabs} />

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Change Password Modal */}
      {changePasswordOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setChangePasswordOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Change Password</h3>
              <button 
                onClick={() => setChangePasswordOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
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
    
    // Validate current password - only allow alphanumeric and basic special characters (no emojis)
    const passwordCharRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~ ]+$/;
    if (!passwordCharRegex.test(currentPassword)) {
      setError('Current password contains invalid characters. Only letters, numbers, and basic special characters are allowed.');
      return;
    }
    
    // Validate new password - only allow alphanumeric and basic special characters (no emojis)
    if (!passwordCharRegex.test(newPassword)) {
      setError('New password contains invalid characters. Only letters, numbers, and basic special characters are allowed.');
      return;
    }
    
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
      const { apiRequest } = await import('@/lib/api');
      await apiRequest('/auth/change-password', 'POST', {
        currentPassword,
        newPassword
      });
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
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
          <KeyRound size={28} />
        </div>
        <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">Password Changed</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">Your password has been successfully updated.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 text-xs font-medium">
          {error}
        </div>
      )}
      
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
          Current Password
        </label>
        <div className="relative">
          <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            placeholder="Enter current password"
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
          New Password
        </label>
        <div className="relative">
          <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="Enter new password"
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
          Confirm New Password
        </label>
        <div className="relative">
          <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm new password"
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Change Password'}
        </button>
      </div>
    </form>
  );
}

