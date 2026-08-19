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
  requestOtp: (studentId: string, googleCredential?: string) => Promise<{ otpRequired?: boolean; email?: string; fallbackOtp?: string }>;

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

  // Load user from local storage or check backend
  useEffect(() => {
    if (!mounted) return;

    async function loadUser() {
      const mockToken = localStorage.getItem('COMPSSA_token');
      if (mockToken) {
        try {
          const res = await apiRequest<{ status: string; data: UserProfile }>('/auth/me');
          if (res.status === 'success') {
            setUser(res.data);
            if (res.data.tenantId) {
              localStorage.setItem('COMPSSA_tenantId', res.data.tenantId);
            }
          } else {
            localStorage.removeItem('COMPSSA_token');
          }
        } catch (e) {
          console.error('Failed to restore session from token', e);
          const storedUser = localStorage.getItem('COMPSSA_user');
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
            } catch (parseError) {
              console.error('Failed to parse stored user data', parseError);
              localStorage.removeItem('COMPSSA_token');
            }
          } else {
            localStorage.removeItem('COMPSSA_token');
          }
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [mounted]);

  const login = async (email: string, password?: string, role: 'voter' | 'admin' | 'superadmin' = 'voter'): Promise<{ otpRequired?: boolean; email?: string; phone?: string; fallbackOtp?: string; smsFailed?: boolean }> => {
    setLoading(true);
    try {
      if (role === 'superadmin') {
        if (email !== 'supertech@admin.com' || password !== 'udiosuper') {
          throw new Error('Invalid super administrator credentials.');
        }
        const uid = `superadmin_${email}`;
        const mockToken = `MOCK_${uid}`;
        localStorage.setItem('COMPSSA_token', `Bearer ${mockToken}`);
        const userData = { uid, email, name: 'Super Administrator', role: 'superadmin' as const, status: 'active' };
        localStorage.setItem('COMPSSA_user', JSON.stringify(userData));
        setUser(userData);
        router.push('/superadmin/dashboard');
        return {};
      } else {
        const res = await apiRequest<{ status: string; data?: UserProfile; token?: string; email?: string; phone?: string; fallbackOtp?: string; smsFailed?: boolean }>('/auth/login', 'POST', { email, password });
        if (res.status === 'otp_required') {
          return { otpRequired: true, email: res.email, phone: res.phone, fallbackOtp: res.fallbackOtp, smsFailed: res.smsFailed };
        }
        if (res.status === 'success' && res.token) {
          localStorage.setItem('COMPSSA_token', `Bearer ${res.token}`);
          localStorage.setItem('COMPSSA_user', JSON.stringify(res.data));
          if (res.data?.tenantId) {
            localStorage.setItem('COMPSSA_tenantId', res.data.tenantId);
          }
          setUser(res.data!);
          
          if (res.data!.role === 'admin') {
            router.push('/admin/dashboard');
          } else {
            router.push('/voter/dashboard');
          }
          return {};
        }
        throw new Error('Unexpected response from server.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async (studentId: string, googleCredential?: string): Promise<{ otpRequired?: boolean; email?: string; fallbackOtp?: string }> => {
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; email?: string; fallbackOtp?: string; message?: string }>('/auth/request-otp', 'POST', {
        studentId,
        googleCredential
      });
      if (res.status === 'success') {
        return { otpRequired: true, email: res.email, fallbackOtp: res.fallbackOtp };
      }
      throw new Error(res.message || 'OTP request failed.');
    } catch (error: any) {
      console.error('Request OTP error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email: string, otp: string): Promise<void> => {
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; data: UserProfile; token: string }>('/auth/verify-otp', 'POST', { email, otp });
      if (res.status === 'success' && res.token) {
        localStorage.setItem('COMPSSA_token', `Bearer ${res.token}`);
        localStorage.setItem('COMPSSA_user', JSON.stringify(res.data));
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

  const logout = () => {
    localStorage.removeItem('COMPSSA_token');
    localStorage.removeItem('COMPSSA_user');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, requestOtp, verifyOtp, logout }}>
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
