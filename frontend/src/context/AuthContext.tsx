'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'voter' | 'admin';
  createdAt?: number;
  status?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password?: string, role?: 'voter' | 'admin') => Promise<{ otpRequired?: boolean; email?: string }>;
  register: (studentId: string, email: string, name: string, password?: string) => Promise<{ otpRequired?: boolean; email?: string }>;
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
      const mockToken = localStorage.getItem('Votick_token');
      if (mockToken) {
        try {
          // If we have a mock token, let's fetch current user info from backend
          const res = await apiRequest<{ status: string; data: UserProfile }>('/auth/me');
          if (res.status === 'success') {
            setUser(res.data);
          } else {
            localStorage.removeItem('Votick_token');
          }
        } catch (e) {
          console.error('Failed to restore session from token', e);
          localStorage.removeItem('Votick_token');
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [mounted]);

  const login = async (email: string, password?: string, role: 'voter' | 'admin' = 'voter'): Promise<{ otpRequired?: boolean; email?: string }> => {
    setLoading(true);
    try {
      if (role === 'admin') {
        if (email !== 'admin@htu.edu.gh' || password !== 'admin080') {
          throw new Error('Invalid administrator credentials. Use email: admin@htu.edu.gh, password: admin080');
        }
        const uid = `admin_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const mockToken = `MOCK_${uid}`;
        localStorage.setItem('Votick_token', mockToken);
        setUser({ uid, email, name: 'System Administrator', role: 'admin', status: 'active' });
        router.push('/admin/dashboard');
        return {};
      } else {
        const res = await apiRequest<{ status: string; data?: UserProfile; token?: string; email?: string }>('/auth/login', 'POST', { email, password });
        if (res.status === 'otp_required') {
          return { otpRequired: true, email: res.email };
        }
        if (res.status === 'success' && res.token) {
          localStorage.setItem('Votick_token', `Bearer ${res.token}`);
          setUser(res.data!);
          router.push('/voter/dashboard');
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

  const register = async (studentId: string, email: string, name: string, password?: string): Promise<{ otpRequired?: boolean; email?: string }> => {
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; email?: string; token?: string; data?: UserProfile }>('/auth/register', 'POST', { studentId, email, name, password });
      if (res.status === 'otp_required') {
        return { otpRequired: true, email: res.email };
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
      if (res.status === 'success' && res.token) {
        localStorage.setItem('Votick_token', `Bearer ${res.token}`);
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
    localStorage.removeItem('Votick_token');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyOtp, logout }}>
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
