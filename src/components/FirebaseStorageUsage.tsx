'use client';

import { useState, useEffect } from 'react';

interface StorageData {
  used: number;
  limit: number;
  usedFormatted: string;
  limitFormatted: string;
  percentUsed: number;
}

export function FirebaseStorageUsage() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchUsage() {
      try {
        const res = await fetch('/api/firebase-storage');
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || 'Failed to load');
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load storage usage');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-black/10 bg-white/80 p-4">
        <div className="text-sm font-medium text-black/60">Temporary storage (Firebase)</div>
        <div className="mt-1 h-2 w-full rounded-full bg-black/10 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-black/10 bg-white/80 p-4">
        <div className="text-sm font-medium text-black/60">Temporary storage (Firebase)</div>
        <p className="mt-1 text-sm text-black/50">{error || 'Unavailable'}</p>
      </div>
    );
  }

  const isNearLimit = data.percentUsed >= 80;
  const isAtLimit = data.percentUsed >= 100;

  return (
    <div className="rounded-xl border border-black/10 bg-white/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-black/60">Temporary storage (Firebase)</div>
        <span
          className={`text-sm font-semibold tabular-nums ${
            isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-black'
          }`}
        >
          {data.usedFormatted} / {data.limitFormatted}
        </span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-black/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-[#061E26]'
          }`}
          style={{ width: `${Math.min(100, data.percentUsed)}%` }}
        />
      </div>
      {isNearLimit && (
        <p className="mt-1.5 text-xs text-black/60">
          {isAtLimit
            ? 'Storage limit reached. New uploads will be blocked until videos are archived to Google Drive.'
            : 'Storage is almost full. Consider archiving approved videos to free space.'}
        </p>
      )}
    </div>
  );
}
