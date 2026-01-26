'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      
      if (!supabaseUser) {
        setUser(null);
        return;
      }

      // Fetch user from our API (which gets data from Airtable)
      const response = await fetch('/api/me');
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setError(data.error || 'User not provisioned');
        } else {
          setError(data.error || 'Failed to fetch user');
        }
        setUser(null);
        return;
      }

      setUser(data.data);
    } catch (err) {
      console.error('Error fetching user:', err);
      setError('Failed to fetch user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [supabase.auth]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUser, supabase.auth]);

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut, refreshUser: fetchUser }}>
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
