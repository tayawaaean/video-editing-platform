'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/types';

interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated' || !session?.user) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/me');
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      if (!response.ok) {
        if (response.status === 401) {
          setUser(null);
          setError(null);
        } else if (isJson) {
          const data = await response.json();
          setError(data.error || 'Failed to fetch user');
        } else {
          const text = await response.text();
          setError(text ? text.substring(0, 100) : 'Failed to fetch user');
        }
        setLoading(false);
        return;
      }

      if (!isJson) {
        setError('Invalid response from server');
        setLoading(false);
        return;
      }
      const data = await response.json();
      setUser(data.user);
      setError(null);
    } catch (err) {
      console.error('Error fetching user:', err);
      setError('Failed to fetch user');
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signOut = async () => {
    try {
      await nextAuthSignOut({ redirect: false });
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const refreshUser = async () => {
    setLoading(true);
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut, refreshUser }}>
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
