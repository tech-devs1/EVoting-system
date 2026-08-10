'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to save session tokens isolated by role
  const saveSession = (data: UserProfile, token: string) => {
    const bearerToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    const userStr = JSON.stringify(data);
    const tenant = data.tenantId || 'default_tenant';

    if (data.role === 'admin' || data.role === 'superadmin') {
      sessionStorage.setItem('COMPSSA_admin_token', bearerToken);
      sessionStorage.setItem('COMPSSA_admin_user', userStr);
      sessionStorage.setItem('COMPSSA_admin_tenantId', tenant);
      localStorage.setItem('COMPSSA_admin_token', bearerToken);
      localStorage.setItem('COMPSSA_admin_user', userStr);
      localStorage.setItem('COMPSSA_admin_tenantId', tenant);
    } else {
      sessionStorage.setItem('COMPSSA_voter_token', bearerToken);
      sessionStorage.setItem('COMPSSA_voter_user', userStr);
      sessionStorage.setItem('COMPSSA_voter_tenantId', tenant);
      localStorage.setItem('COMPSSA_voter_token', bearerToken);
      localStorage.setItem('COMPSSA_voter_user', userStr);
      localStorage.setItem('COMPSSA_voter_tenantId', tenant);
    }

    // Set fallback token for backward compatibility
    localStorage.setItem('COMPSSA_token', bearerToken);
    localStorage.setItem('COMPSSA_user', userStr);
    localStorage.setItem('COMPSSA_tenantId', tenant);
  };

  // Load user from local/session storage or check backend
  useEffect(() => {
    if (!mounted) return;

    async function loadUser() {
      try {
        const path = window.location.pathname;
        let storedToken: string | null = null;
        let storedUserStr: string | null = null;

        if (path.startsWith('/admin') || path.startsWith('/superadmin')) {
          storedToken = sessionStorage.getItem('COMPSSA_admin_token') || localStorage.getItem('COMPSSA_admin_token') || localStorage.getItem('COMPSSA_token');
          storedUserStr = sessionStorage.getItem('COMPSSA_admin_user') || localStorage.getItem('COMPSSA_admin_user') || localStorage.getItem('COMPSSA_user');
        } else if (path.startsWith('/voter')) {
          storedToken = sessionStorage.getItem('COMPSSA_voter_token') || localStorage.getItem('COMPSSA_voter_token') || localStorage.getItem('COMPSSA_token');
          storedUserStr = sessionStorage.getItem('COMPSSA_voter_user') || localStorage.getItem('COMPSSA_voter_user') || localStorage.getItem('COMPSSA_user');
        } else {
          storedToken = sessionStorage.getItem('COMPSSA_admin_token') || localStorage.getItem('COMPSSA_admin_token') ||
                        sessionStorage.getItem('COMPSSA_voter_token') || localStorage.getItem('COMPSSA_voter_token') ||
                        localStorage.getItem('COMPSSA_token');
          storedUserStr = sessionStorage.getItem('COMPSSA_admin_user') || localStorage.getItem('COMPSSA_admin_user') ||
                          sessionStorage.getItem('COMPSSA_voter_user') || localStorage.getItem('COMPSSA_voter_user') ||
                          localStorage.getItem('COMPSSA_user');
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
        
        if (res.data.role === 'superadmin') {
          router.push('/superadmin/dashboard');
        } else if (res.data.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          router.push('/voter/elections');
        }
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
        router.push('/voter/dashboard');
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

        if (res.data.role === 'superadmin') {
          router.push('/superadmin/dashboard');
        } else if (res.data.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          router.push('/voter/elections');
        }
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
    if (path.startsWith('/admin') || path.startsWith('/superadmin')) {
      sessionStorage.removeItem('COMPSSA_admin_token');
      sessionStorage.removeItem('COMPSSA_admin_user');
      localStorage.removeItem('COMPSSA_admin_token');
      localStorage.removeItem('COMPSSA_admin_user');
    } else {
      sessionStorage.removeItem('COMPSSA_voter_token');
      sessionStorage.removeItem('COMPSSA_voter_user');
      localStorage.removeItem('COMPSSA_voter_token');
      localStorage.removeItem('COMPSSA_voter_user');
    }
    localStorage.removeItem('COMPSSA_token');
    localStorage.removeItem('COMPSSA_user');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, verifyOtp, logout }}>
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
