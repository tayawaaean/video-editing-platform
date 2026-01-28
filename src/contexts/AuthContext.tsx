'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useDataCache } from './DataCacheContext';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AUTH_USER_STORAGE_KEY = 'auth:user';

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AUTH_USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user: User | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  } catch {
    // Ignore quota or parse errors
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { getCache, setCache, clearCache } = useDataCache();
  const cachedUser = getCache<User>('user:current') ?? getStoredUser();

  const [user, setUser] = useState<User | null>(cachedUser || null);
  const [loading, setLoading] = useState(!cachedUser);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  const fetchUser = useCallback(async (forceRefresh = false) => {
    // Check cache first - only fetch if no cache or forced refresh
    const cached = getCache<User>('user:current');
    if (cached && !forceRefresh) {
      setUser(cached);
      setLoading(false);
      setError(null);
      // Still fetch in background to keep data fresh, but don't show loading
      fetch('/api/me', { credentials: 'include' })
        .then(async (response) => {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (response.ok && data.data) {
              setUser(data.data);
              setCache('user:current', data.data);
              setStoredUser(data.data);
            }
          }
        })
        .catch(() => {
          // Silently fail background refresh
        });
      return;
    }
    
    try {
      // Only show loading if we don't have cached data
      if (!cached) {
        setLoading(true);
      }
      setError(null);

      // Simply call /api/me - it handles all authentication (browser may cache per Cache-Control)
      const response = await fetch('/api/me', { credentials: 'include' });
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }
      
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setError(data.error || 'User not provisioned');
        } else {
          setError(data.error || 'Failed to fetch user');
        }
        setUser(null);
        clearCache('user:current');
        setStoredUser(null);
        return;
      }

      setUser(data.data);
      setCache('user:current', data.data);
      setStoredUser(data.data);
    } catch (err) {
      console.error('Error fetching user:', err);
      setError('Failed to fetch user');
      setUser(null);
      clearCache('user:current');
      setStoredUser(null);
    } finally {
      setLoading(false);
    }
  }, [setCache, getCache, clearCache]);

  const signOut = async () => {
    if (isDevMode) {
      // In dev mode, clear the dev cookie
      await fetch('/api/auth/dev-logout', { method: 'POST' });
    } else {
      await supabase.auth.signOut();
    }
    setUser(null);
    clearCache('user:current');
    setStoredUser(null);
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    // Only fetch on mount if we don't have cached data
    const cached = getCache<User>('user:current');
    if (!cached) {
      fetchUser(false);
    }

    // Only listen to Supabase auth changes in production mode
    if (!isDevMode) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          fetchUser(true); // Force refresh on sign in
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          clearCache('user:current');
          setStoredUser(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut, refreshUser: () => fetchUser(true) }}>
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
