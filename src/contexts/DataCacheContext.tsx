'use client';

import { createContext, useContext, useRef, useCallback, ReactNode, useState } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface DataCacheContextType {
  getCache: <T>(key: string) => T | null;
  setCache: <T>(key: string, data: T) => void;
  clearCache: (key?: string) => void;
  hasCache: (key: string) => boolean;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Map<string, CacheEntry<any>>>(new Map());
  // Counter only used to force re-render when cache is cleared entirely
  const [, setVersion] = useState(0);

  const getCache = useCallback(<T,>(key: string): T | null => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;

    // Check if cache is expired
    const now = Date.now();
    if (now - entry.timestamp > CACHE_DURATION) {
      cacheRef.current.delete(key);
      return null;
    }

    return entry.data as T;
  }, []);

  const setCache = useCallback(<T,>(key: string, data: T) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    });
  }, []);

  const clearCache = useCallback((key?: string) => {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current = new Map();
      setVersion(v => v + 1);
    }
  }, []);

  const hasCache = useCallback((key: string): boolean => {
    const entry = cacheRef.current.get(key);
    if (!entry) return false;

    // Check if cache is expired
    const now = Date.now();
    if (now - entry.timestamp > CACHE_DURATION) {
      cacheRef.current.delete(key);
      return false;
    }

    return true;
  }, []);

  return (
    <DataCacheContext.Provider value={{ getCache, setCache, clearCache, hasCache }}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
}
