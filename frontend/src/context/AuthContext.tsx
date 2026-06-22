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
  login: (email: string, role?: 'voter' | 'admin') => Promise<void>;
  register: (email: string, name: string, role?: 'voter' | 'admin') => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  // Load user from local storage or check backend
  useEffect(() => {
    async function loadUser() {
      const mockToken = localStorage.getItem('votetrust_token');
      if (mockToken) {
        try {
          // If we have a mock token, let's fetch current user info from backend
          const res = await apiRequest<{ status: string; data: UserProfile }>('/auth/me');
          if (res.status === 'success') {
            setUser(res.data);
          } else {
            localStorage.removeItem('votetrust_token');
          }
        } catch (e) {
          console.error('Failed to restore session from token', e);
          localStorage.removeItem('votetrust_token');
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  const login = async (email: string, role: 'voter' | 'admin' = 'voter') => {
    setLoading(true);
    try {
      // Create a mock client-side uid based on email
      const uid = `uid_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const mockToken = `MOCK_${uid}`;
      
      // Store mock token
      localStorage.setItem('votetrust_token', mockToken);

      // Register or update profile in backend db
      try {
        await apiRequest('/auth/register', 'POST', {
          uid,
          email,
          name: email.split('@')[0],
          role
        });
      } catch (e) {
        // User may already be registered, swallow error
        console.log('Register check on login:', e);
      }

      // Fetch user profile
      const res = await apiRequest<{ status: string; data: UserProfile }>('/auth/me');
      setUser(res.data);

      if (res.data.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/voter/dashboard');
      }
    } catch (e) {
      localStorage.removeItem('votetrust_token');
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, name: string, role: 'voter' | 'admin' = 'voter') => {
    setLoading(true);
    try {
      const uid = `uid_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const mockToken = `MOCK_${uid}`;
      localStorage.setItem('votetrust_token', mockToken);

      await apiRequest('/auth/register', 'POST', {
        uid,
        email,
        name,
        role
      });

      const res = await apiRequest<{ status: string; data: UserProfile }>('/auth/me');
      setUser(res.data);

      if (res.data.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/voter/dashboard');
      }
    } catch (e) {
      localStorage.removeItem('votetrust_token');
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('votetrust_token');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
