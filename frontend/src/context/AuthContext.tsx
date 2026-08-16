'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { hardNavigate } from '@/lib/navigation';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'voter' | 'admin' | 'superadmin';
  tenantId?: string;
  createdAt?: number;
  status?: string;
  faceImage?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password?: string, role?: 'voter' | 'admin' | 'superadmin') => Promise<{ otpRequired?: boolean; email?: string; phone?: string; fallbackOtp?: string; smsFailed?: boolean }>;
  register: (studentId: string, email: string, name: string, password?: string, phone?: string, faceImage?: string) => Promise<{ otpRequired?: boolean; email?: string; phone?: string }>;
  loginWithGoogle: (idToken: string) => Promise<UserProfile>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Destination + copy for the post-auth success dialog, by role.
function successInfoFor(data: UserProfile) {
  if (data.role === 'superadmin') {
    return {
      targetPath: '/superadmin/dashboard',
      subtitle: 'You are signed in to the platform administration console.',
    };
  }
  if (data.role === 'admin') {
    return {
      targetPath: '/admin/dashboard',
      subtitle: 'You are signed in to the election management dashboard.',
    };
  }
  return {
    targetPath: '/voter/elections',
    subtitle: 'Your ballot is ready — head to the voting portal to cast your vote.',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);
  // Shown after a successful sign-in instead of auto-redirecting: iOS Safari on
  // statically-exported cPanel sites can fail to render the page after a JS
  // redirect, so we let the user tap a real link (native navigation) instead.
  const [authSuccess, setAuthSuccess] = useState<{ targetPath: string; subtitle: string } | null>(null);

  // When the success banner appears, dismiss any open keyboard, make sure it is
  // scrolled into view, and auto-redirect to the role dashboard shortly after
  // (a real page load — reliable on iOS Safari now that the app runs there).
  // Dismissing the banner cancels the pending redirect.
  useEffect(() => {
    if (!authSuccess) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const card = document.getElementById('auth-success-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = setTimeout(() => {
      window.location.assign(authSuccess.targetPath);
    }, 2500);
    return () => clearTimeout(timer);
  }, [authSuccess]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Safe storage helper for Mobile Safari / Private Browsing / strict quota environments
  const safeSetItem = (storage: Storage | null, key: string, value: string) => {
    try {
      if (storage) {
        storage.setItem(key, value);
      }
    } catch (err) {
      console.warn(`[Storage] Failed to set ${key} in storage:`, err);
    }
  };

  const safeGetItem = (storage: Storage | null, key: string): string | null => {
    try {
      if (storage) {
        return storage.getItem(key);
      }
    } catch (err) {
      console.warn(`[Storage] Failed to get ${key} from storage:`, err);
    }
    return null;
  };

  const safeRemoveItem = (storage: Storage | null, key: string) => {
    try {
      if (storage) {
        storage.removeItem(key);
      }
    } catch (err) {
      console.warn(`[Storage] Failed to remove ${key} from storage:`, err);
    }
  };

  // Auth transitions always use a full page load. Client-side router.push is
  // unreliable on iOS Safari for statically-exported (cPanel) sites: the URL can
  // change while the new page never renders. Hard navigation through the SPA
  // fallback (.htaccess) always lands on the correct page.
  const safeNavigate = (targetPath: string) => {
    hardNavigate(targetPath);
  };

  // Helper to save session tokens isolated by role & tab
  const saveSession = (data: UserProfile, token: string) => {
    const bearerToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    const userStr = JSON.stringify(data);
    const tenant = data.tenantId || 'default_tenant';

    const session = typeof window !== 'undefined' ? window.sessionStorage : null;
    const local = typeof window !== 'undefined' ? window.localStorage : null;

    // 1. ALWAYS set tab-specific session storage
    safeSetItem(session, 'COMPSSA_tab_token', bearerToken);
    safeSetItem(session, 'COMPSSA_tab_user', userStr);
    safeSetItem(session, 'COMPSSA_tab_tenantId', tenant);

    // 2. Set role-isolated storage keys
    if (data.role === 'superadmin') {
      safeSetItem(session, 'COMPSSA_superadmin_token', bearerToken);
      safeSetItem(session, 'COMPSSA_superadmin_user', userStr);
      safeSetItem(session, 'COMPSSA_superadmin_tenantId', tenant);
      safeSetItem(local, 'COMPSSA_superadmin_token', bearerToken);
      safeSetItem(local, 'COMPSSA_superadmin_user', userStr);
      safeSetItem(local, 'COMPSSA_superadmin_tenantId', tenant);
    } else if (data.role === 'admin') {
      safeSetItem(session, 'COMPSSA_admin_token', bearerToken);
      safeSetItem(session, 'COMPSSA_admin_user', userStr);
      safeSetItem(session, 'COMPSSA_admin_tenantId', tenant);
      safeSetItem(local, 'COMPSSA_admin_token', bearerToken);
      safeSetItem(local, 'COMPSSA_admin_user', userStr);
      safeSetItem(local, 'COMPSSA_admin_tenantId', tenant);
    } else {
      safeSetItem(session, 'COMPSSA_voter_token', bearerToken);
      safeSetItem(session, 'COMPSSA_voter_user', userStr);
      safeSetItem(session, 'COMPSSA_voter_tenantId', tenant);
      safeSetItem(local, 'COMPSSA_voter_token', bearerToken);
      safeSetItem(local, 'COMPSSA_voter_user', userStr);
      safeSetItem(local, 'COMPSSA_voter_tenantId', tenant);
    }

    // Set fallback token for backward compatibility
    safeSetItem(local, 'COMPSSA_token', bearerToken);
    safeSetItem(local, 'COMPSSA_user', userStr);
    safeSetItem(local, 'COMPSSA_tenantId', tenant);
  };

  // Load user from local/session storage or check backend
  useEffect(() => {
    if (!mounted) return;

    async function loadUser() {
      try {
        const path = window.location.pathname;
        let storedToken: string | null = null;
        let storedUserStr: string | null = null;

        const session = typeof window !== 'undefined' ? window.sessionStorage : null;
        const local = typeof window !== 'undefined' ? window.localStorage : null;

        if (path.startsWith('/superadmin')) {
          storedToken = safeGetItem(session, 'COMPSSA_tab_token') ||
                        safeGetItem(session, 'COMPSSA_superadmin_token') ||
                        safeGetItem(local, 'COMPSSA_superadmin_token') ||
                        safeGetItem(local, 'COMPSSA_token');
          storedUserStr = safeGetItem(session, 'COMPSSA_tab_user') ||
                          safeGetItem(session, 'COMPSSA_superadmin_user') ||
                          safeGetItem(local, 'COMPSSA_superadmin_user') ||
                          safeGetItem(local, 'COMPSSA_user');
        } else if (path.startsWith('/admin')) {
          storedToken = safeGetItem(session, 'COMPSSA_tab_token') ||
                        safeGetItem(session, 'COMPSSA_admin_token') ||
                        safeGetItem(local, 'COMPSSA_admin_token') ||
                        safeGetItem(local, 'COMPSSA_token');
          storedUserStr = safeGetItem(session, 'COMPSSA_tab_user') ||
                          safeGetItem(session, 'COMPSSA_admin_user') ||
                          safeGetItem(local, 'COMPSSA_admin_user') ||
                          safeGetItem(local, 'COMPSSA_user');
        } else if (path.startsWith('/voter')) {
          storedToken = safeGetItem(session, 'COMPSSA_tab_token') ||
                        safeGetItem(session, 'COMPSSA_voter_token') ||
                        safeGetItem(local, 'COMPSSA_voter_token') ||
                        safeGetItem(local, 'COMPSSA_token');
          storedUserStr = safeGetItem(session, 'COMPSSA_tab_user') ||
                          safeGetItem(session, 'COMPSSA_voter_user') ||
                          safeGetItem(local, 'COMPSSA_voter_user') ||
                          safeGetItem(local, 'COMPSSA_user');
        } else {
          storedToken = safeGetItem(session, 'COMPSSA_tab_token') ||
                        safeGetItem(session, 'COMPSSA_superadmin_token') ||
                        safeGetItem(session, 'COMPSSA_admin_token') ||
                        safeGetItem(session, 'COMPSSA_voter_token') ||
                        safeGetItem(local, 'COMPSSA_token');
          storedUserStr = safeGetItem(session, 'COMPSSA_tab_user') ||
                          safeGetItem(session, 'COMPSSA_superadmin_user') ||
                          safeGetItem(session, 'COMPSSA_admin_user') ||
                          safeGetItem(session, 'COMPSSA_voter_user') ||
                          safeGetItem(local, 'COMPSSA_user');
        }

        if (storedToken) {
          const res = await apiRequest<{ status: string; data: UserProfile }>('/auth/me');
          if (res.status === 'success') {
            setUser(res.data);
          } else if (storedUserStr) {
            setUser(JSON.parse(storedUserStr));
          }
        }
      } catch (e) {
        console.error('Failed to restore session from token', e);
      } finally {
        setLoading(false);
      }
    }
    loadUser();

    // iOS Safari bfcache guard: after a successful sign-in, Safari's swipe-back
    // (or the back button) can restore the login page from the back-forward
    // cache, making it look like the redirect never happened. On a persisted
    // page restore, re-validate the session and bounce to the role dashboard.
    const handlePageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const session = typeof window !== 'undefined' ? window.sessionStorage : null;
      const local = typeof window !== 'undefined' ? window.localStorage : null;
      const token =
        safeGetItem(session, 'COMPSSA_tab_token') ||
        safeGetItem(local, 'COMPSSA_token');
      if (!token) return;

      apiRequest<{ status: string; data?: UserProfile }>('/auth/me')
        .then((res) => {
          if (res.status === 'success' && res.data) {
            const targetPath =
              res.data.role === 'superadmin'
                ? '/superadmin/dashboard'
                : res.data.role === 'admin'
                ? '/admin/dashboard'
                : '/voter/elections';
            if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
              window.location.assign(targetPath);
            }
          }
        })
        .catch(() => {
          // Token invalid — let the route guard send the user to /login.
        });
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [mounted]);

  const login = async (email: string, password?: string, role: 'voter' | 'admin' | 'superadmin' = 'voter'): Promise<{ otpRequired?: boolean; email?: string; phone?: string; fallbackOtp?: string; smsFailed?: boolean }> => {
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; data?: UserProfile; token?: string; email?: string; phone?: string; fallbackOtp?: string; smsFailed?: boolean }>('/auth/login', 'POST', { email, password, role });
      if (res.status === 'otp_required') {
        return { otpRequired: true, email: res.email, phone: res.phone, fallbackOtp: res.fallbackOtp, smsFailed: res.smsFailed };
      }
      if (res.status === 'success' && res.token && res.data) {
        saveSession(res.data, res.token);
        setUser(res.data);
        setAuthSuccess(successInfoFor(res.data));
        return {};
      }
      throw new Error('Unexpected response from server.');
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (studentId: string, email: string, name: string, password?: string, phone?: string, faceImage?: string): Promise<{ otpRequired?: boolean; email?: string; phone?: string }> => {
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; email?: string; phone?: string; token?: string; data?: UserProfile }>('/auth/register', 'POST', {
        studentId,
        email,
        name,
        password,
        phone,
        faceImage
      });
      if (res.status === 'otp_required') {
        return { otpRequired: true, email: res.email, phone: res.phone };
      }
      if (res.status === 'success') {
        return {};
      }
      throw new Error('Registration failed due to server error.');
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email: string, otp: string): Promise<void> => {
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; data: UserProfile; token: string }>('/auth/verify-otp', 'POST', { email, otp });
      if (res.status === 'success' && res.token && res.data) {
        saveSession(res.data, res.token);
        setUser(res.data);
        setAuthSuccess(successInfoFor(res.data));
      } else {
        throw new Error('OTP verification failed.');
      }
    } catch (error: any) {
      console.error('OTP error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<UserProfile> => {
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; data: UserProfile; token: string }>('/auth/google-login', 'POST', { idToken });
      if (res.status === 'success' && res.token && res.data) {
        saveSession(res.data, res.token);
        setUser(res.data);
        setAuthSuccess(successInfoFor(res.data));
        return res.data;
      }
      throw new Error('Google authentication failed.');
    } catch (error: any) {
      console.error('Google Auth Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const session = typeof window !== 'undefined' ? window.sessionStorage : null;
    const local = typeof window !== 'undefined' ? window.localStorage : null;
    
    safeRemoveItem(session, 'COMPSSA_tab_token');
    safeRemoveItem(session, 'COMPSSA_tab_user');
    safeRemoveItem(session, 'COMPSSA_tab_tenantId');

    if (path.startsWith('/superadmin')) {
      safeRemoveItem(session, 'COMPSSA_superadmin_token');
      safeRemoveItem(session, 'COMPSSA_superadmin_user');
      safeRemoveItem(local, 'COMPSSA_superadmin_token');
      safeRemoveItem(local, 'COMPSSA_superadmin_user');
    } else if (path.startsWith('/admin')) {
      safeRemoveItem(session, 'COMPSSA_admin_token');
      safeRemoveItem(session, 'COMPSSA_admin_user');
      safeRemoveItem(local, 'COMPSSA_admin_token');
      safeRemoveItem(local, 'COMPSSA_admin_user');
    } else {
      safeRemoveItem(session, 'COMPSSA_voter_token');
      safeRemoveItem(session, 'COMPSSA_voter_user');
      safeRemoveItem(local, 'COMPSSA_voter_token');
      safeRemoveItem(local, 'COMPSSA_voter_user');
    }
    safeRemoveItem(local, 'COMPSSA_token');
    safeRemoveItem(local, 'COMPSSA_user');
    setUser(null);
    safeNavigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, verifyOtp, logout }}>
      {/* ── Signed-in success banner ───────────────────────────────────
          A slim IN-FLOW banner (no position:fixed — iOS keyboard/viewport
          quirks), shown briefly after sign-in. It auto-redirects to the role
          dashboard after a short pause; a native <a href> is included for an
          instant jump, and dismissing cancels the redirect. */}
      {authSuccess && (
        <div
          id="auth-success-card"
          role="status"
          aria-live="polite"
          className="relative z-50 bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-3.5"
        >
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-extrabold text-emerald-900 leading-tight">
                Signed in successfully!
              </h2>
              <p className="text-xs text-emerald-800 font-medium leading-snug mt-0.5">
                Redirecting you to your dashboard…
              </p>
            </div>
            <a
              href={authSuccess.targetPath}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow transition-all active:scale-[0.98] touch-manipulation"
            >
              Go now
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setAuthSuccess(null)}
              aria-label="Dismiss"
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-emerald-700 hover:bg-emerald-100 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
