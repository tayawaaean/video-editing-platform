'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StatusBadge, EmptyState, VideoIcon, TableSkeleton, StatCard, FirebaseStorageUsage } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import type { Submission, SubmissionStatus } from '@/types';

export default function SubmitterDashboardPage() {
  const { user } = useAuth();
  const { getCache, setCache } = useDataCache();
  
  // Initialize with cache if available
  const getCacheKey = (filter: string) => {
    return `submissions:submitter:${user?.id || 'unknown'}:${filter || 'all'}`;
  };
  
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    return getCache<Submission[]>(getCacheKey('all')) || [];
  });
  const [loading, setLoading] = useState(() => {
    return !getCache<Submission[]>(getCacheKey('all'));
  });
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const cacheKey = `submissions:submitter:${user?.id || 'unknown'}:all`;
      
      // Check cache first
      const cachedData = getCache<Submission[]>(cacheKey);
      if (cachedData && showLoading) {
        setSubmissions(cachedData);
        setLoading(false);
        setError(null);
        // Still fetch in background to refresh
        showLoading = false;
      }
      
      const response = await fetch(`/api/submissions`);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch submissions');
      }

      setSubmissions(data.data);
      setCache(cacheKey, data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [user?.id, getCache, setCache]);

  useEffect(() => {
    if (!user) return;
    
    const cacheKey = `submissions:submitter:${user.id}:all`;
    const cachedData = getCache<Submission[]>(cacheKey);
    
    if (cachedData) {
      // Use cached data immediately, no skeleton
      setSubmissions(cachedData);
      setLoading(false);
      // Fetch fresh data in background
      fetchSubmissions(false);
    } else {
      // No cache, fetch with loading
      setLoading(true);
      fetchSubmissions(true);
    }
  }, [user, fetchSubmissions, getCache]);

  // Sort by updated_at (most recent first) for latest submissions
  const sortedSubmissions = [...submissions].sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // Get latest 3 submissions for dashboard preview
  const latestSubmissions = sortedSubmissions.slice(0, 3);

  const stats = {
    total: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    reviewing: submissions.filter((s) => s.status === 'reviewing').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-black">Dashboard</h1>
        <p className="mt-3 text-lg font-light tracking-wide text-black/70">
          Overview of your submissions and activity
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <StatCard
          label="Total"
          value={stats.total}
          tone="primary"
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          tone="accent"
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        />
        <StatCard
          label="In Review"
          value={stats.reviewing}
          tone="secondary"
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          tone="dark"
          icon={(
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        />
      </div>

      <div className="mb-10">
        <FirebaseStorageUsage />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-black">Recent submissions</h2>
        <div className="flex gap-3">
          <Link
            href="/submissions"
            className="group relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg transition-all duration-200"
          >
            View all submissions
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/submissions/new"
            className="group relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#061E26] to-black text-white rounded-xl font-semibold shadow-lg shadow-[#061E26]/30 hover:shadow-xl hover:shadow-[#061E26]/40 hover:scale-105 transition-all duration-200"
          >
            <svg className="-ml-1 h-5 w-5 group-hover:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New submission
          </Link>
        </div>
      </div>

      {!loading && !error && latestSubmissions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {latestSubmissions.map((submission) => (
            <Link
              key={submission.id}
              href={`/submissions/${submission.id}`}
              className="block bg-white rounded-xl shadow-sm border border-black/10 p-5 hover:shadow-md hover:border-[#061E26]/30 transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-base font-semibold text-black line-clamp-2">{submission.title}</h3>
                <StatusBadge status={submission.status} size="sm" />
              </div>
              {submission.description && (
                <p className="text-sm text-black/60 line-clamp-2 mb-3">{submission.description}</p>
              )}
              <p className="text-xs text-black/50">Updated {new Date(submission.updated_at).toLocaleDateString()}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-[#061E26] mt-2">
                View submission
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && latestSubmissions.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-black/10 p-8 mb-6 text-center">
          <p className="text-black/60 mb-4">No submissions yet</p>
          <Link
            href="/submissions/new"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#061E26] to-black rounded-xl hover:shadow-lg transition-all"
          >
            Create your first submission
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      {submissions.length > 3 && (
        <div className="mt-4">
          <Link
            href="/submissions"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg transition-colors"
          >
            View all {submissions.length} submissions
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

