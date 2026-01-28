'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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
  const [cache, setCacheState] = useState<Map<string, CacheEntry<any>>>(new Map());

  const getCache = useCallback(<T,>(key: string): T | null => {
    const entry = cache.get(key);
    if (!entry) return null;

    // Check if cache is expired
    const now = Date.now();
    if (now - entry.timestamp > CACHE_DURATION) {
      cache.delete(key);
      return null;
    }

    return entry.data as T;
  }, [cache]);

  const setCache = useCallback(<T,>(key: string, data: T) => {
    setCacheState(prev => {
      const newCache = new Map(prev);
      newCache.set(key, {
        data,
        timestamp: Date.now(),
      });
      return newCache;
    });
  }, []);

  const clearCache = useCallback((key?: string) => {
    if (key) {
      setCacheState(prev => {
        const newCache = new Map(prev);
        newCache.delete(key);
        return newCache;
      });
    } else {
      setCacheState(new Map());
    }
  }, []);

  const hasCache = useCallback((key: string): boolean => {
    const entry = cache.get(key);
    if (!entry) return false;

    // Check if cache is expired
    const now = Date.now();
    if (now - entry.timestamp > CACHE_DURATION) {
      cache.delete(key);
      return false;
    }

    return true;
  }, [cache]);

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
