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
  login: (email: string, password?: string, role?: 'voter' | 'admin') => Promise<void>;
  register: (studentId: string, email: string, name: string, password?: string) => Promise<void>;
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

  const login = async (email: string, password?: string, role: 'voter' | 'admin' = 'voter') => {
    setLoading(true);
    try {
      // If admin, we keep the previous mock logic for now since admin login isn't strictly defined,
      // but for voter we hit our new strict backend login endpoint.
      if (role === 'admin') {
        if (email !== 'admin@htu.edu.gh' || password !== 'admin080') {
          throw new Error('Invalid administrator credentials.');
        }
        
        const uid = `admin_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const mockToken = `MOCK_${uid}`;
        localStorage.setItem('votetrust_token', mockToken);
        
        setUser({
          uid,
          email,
          name: 'System Administrator',
          role: 'admin',
          status: 'active'
        });
        
        router.push('/admin/dashboard');
      } else {
        // Strict Student Login
        const res = await apiRequest<{ status: string; data: UserProfile; token: string }>('/auth/login', 'POST', { email, password });

        if (res.status === 'success' && res.token) {
          localStorage.setItem('votetrust_token', `Bearer ${res.token}`);
          setUser(res.data);
          router.push('/voter/dashboard');
        } else {
          throw new Error('Invalid response from server during authentication.');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (studentId: string, email: string, name: string, password?: string) => {
    setLoading(true);
    try {
      // Hit our new strict backend register endpoint
      const res = await apiRequest<{ status: string; data: UserProfile; token: string }>('/auth/register', 'POST', { studentId, email, name, password });

      if (res.status === 'success') {
        // Do not auto login. The user will be requested to login again.
        return;
      } else {
        throw new Error('Registration failed due to server error.');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
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
