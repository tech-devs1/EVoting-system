'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { hardNavigate } from '@/lib/navigation';
import AppLoading from '@/components/AppLoading';

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

// Destination for the post-auth transition, by role.
function targetPathFor(data: UserProfile) {
  if (data.role === 'superadmin') return '/superadmin/dashboard';
  if (data.role === 'admin') return '/admin/dashboard';
  return '/voter/elections';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);
  // Set after a successful sign-in: shows a brief branded loading screen
  // ("Signing you in…") before a full page load to the role dashboard.
  const [authTransition, setAuthTransition] = useState<string | null>(null);

  // Give the loading screen a moment to be visible, then hard-navigate.
  useEffect(() => {
    if (!authTransition) return;
    const timer = setTimeout(() => {
      window.location.assign(authTransition);
    }, 1200);
    return () => clearTimeout(timer);
  }, [authTransition]);

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
        setAuthTransition(targetPathFor(res.data));
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
        setAuthTransition(targetPathFor(res.data));
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
        setAuthTransition(targetPathFor(res.data));
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
      {/* Post-sign-in transition: show the branded loading screen briefly,
          then hard-navigate to the role dashboard. */}
      {authTransition && <AppLoading label="Signing you in…" />}

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
