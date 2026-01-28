'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { parseGoogleDriveUrl } from '@/lib/google-drive';

export default function NewSubmissionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getRoleDashboardPath = () => {
    if (!user) return '/admin/dashboard';
    switch (user.role) {
      case 'admin':
        return '/admin/dashboard';
      case 'reviewer':
        return '/reviewer/dashboard';
      case 'submitter':
        return '/submitter/dashboard';
      default:
        return '/admin/dashboard';
    }
  };

  // Validate URL on blur
  const handleUrlBlur = () => {
    if (!googleDriveUrl) {
      setUrlError(null);
      return;
    }
    const result = parseGoogleDriveUrl(googleDriveUrl);
    if (!result.success) {
      setUrlError(result.error || 'Invalid URL');
    } else {
      setUrlError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate URL before submitting
    const urlResult = parseGoogleDriveUrl(googleDriveUrl);
    if (!urlResult.success) {
      setUrlError(urlResult.error || 'Invalid URL');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          google_drive_url: googleDriveUrl,
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create submission');
      }

      router.push(`/submissions/${data.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <Link
          href={getRoleDashboardPath()}
          className="inline-flex items-center gap-2 text-sm font-medium text-black/70 hover:text-black transition-colors group mb-6"
        >
          <svg className="h-4 w-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        
        <div className="flex items-center gap-4 mb-3">
          <div className="p-3 bg-gradient-to-br from-[#061E26] to-black rounded-2xl shadow-lg shadow-[#061E26]/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-black">Create New Submission</h1>
            <p className="mt-2 text-lg text-black/70">Upload your video for review and feedback</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl mb-6 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-md border border-black/10 p-8 hover:shadow-lg transition-transform duration-300">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-semibold text-black mb-2">
                  Video Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full px-4 py-3 border border-black/20 rounded-xl shadow-sm placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-[#061E26] text-sm transition-shadow"
                  placeholder="e.g., Product Demo Q1 2026"
                />
                <p className="mt-2 text-xs text-black/50">{title.length}/200 characters</p>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-black mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={5}
                  maxLength={5000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full px-4 py-3 border border-black/20 rounded-xl shadow-sm placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-[#061E26] text-sm resize-none transition-shadow"
                  placeholder="Provide context about this video, what needs to be reviewed, or any specific feedback you're looking for..."
                />
                <p className="mt-2 text-xs text-black/50">{description.length}/5000 characters</p>
              </div>

              <div>
                <label htmlFor="googleDriveUrl" className="block text-sm font-semibold text-black mb-2">
                  Google Drive Video URL <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <input
                    type="url"
                    id="googleDriveUrl"
                    required
                    value={googleDriveUrl}
                    onChange={(e) => {
                      setGoogleDriveUrl(e.target.value);
                      setUrlError(null);
                    }}
                    onBlur={handleUrlBlur}
                    className={`block w-full pl-12 pr-4 py-3 border rounded-xl shadow-sm placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-[#061E26] text-sm transition-shadow ${
                      urlError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-black/20'
                    }`}
                    placeholder="https://drive.google.com/file/d/.../view"
                  />
                </div>
                {urlError && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {urlError}
                  </div>
                )}
                <p className="mt-2 text-xs text-black/50">
                  Paste a Google Drive sharing link. Make sure the video is set to &quot;Anyone with the link can view&quot;.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 pt-6 border-t border-black/10">
                <Link
                  href={getRoleDashboardPath()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-black/70 hover:text-black transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#061E26] to-black text-white rounded-xl font-semibold shadow-lg shadow-[#061E26]/30 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Create Submission
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar with Guidelines */}
        <div className="lg:col-span-1 space-y-6">
          {/* URL Format Guide */}
          <div className="bg-gradient-to-br from-[#061E26]/5 to-black/5 rounded-2xl p-6 shadow-md hover:shadow-lg transition-transform duration-300 hover:-translate-y-0.5 ring-1 ring-inset ring-white/60">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#061E26]/10 to-black/10 ring-1 ring-inset ring-[#061E26]/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#061E26]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#061E26]">Supported URL Formats</h3>
                <p className="text-xs text-black/70 mt-1">We accept these Google Drive URL patterns:</p>
              </div>
            </div>
            <ul className="space-y-2 text-xs text-black/80">
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-[#061E26] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <code className="font-mono bg-white/80 border border-white/70 px-2.5 py-1 rounded-md text-[11px] shadow-sm flex-1">drive.google.com/file/d/FILE_ID/view</code>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-[#061E26] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <code className="font-mono bg-white/80 border border-white/70 px-2.5 py-1 rounded-md text-[11px] shadow-sm flex-1">drive.google.com/open?id=FILE_ID</code>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-[#061E26] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <code className="font-mono bg-white/80 border border-white/70 px-2.5 py-1 rounded-md text-[11px] shadow-sm flex-1">drive.google.com/uc?id=FILE_ID</code>
              </li>
            </ul>
          </div>

          {/* Quick Tips */}
          <div className="bg-white rounded-2xl p-6 border border-black/10 shadow-md hover:shadow-lg transition-transform duration-300 hover:-translate-y-0.5">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-9 w-9 rounded-full bg-[#BA836B]/10 ring-1 ring-inset ring-[#BA836B]/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#BA836B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-black">Quick Tips</h3>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-black/70">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 flex items-center justify-center bg-black/5 rounded-full ring-1 ring-inset ring-black/10 text-black/70 font-semibold flex-shrink-0 mt-0.5">
                  <span className="text-xs">1</span>
                </div>
                <span>Choose a clear, descriptive title</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 flex items-center justify-center bg-black/5 rounded-full ring-1 ring-inset ring-black/10 text-black/70 font-semibold flex-shrink-0 mt-0.5">
                  <span className="text-xs">2</span>
                </div>
                <span>Include context in the description</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 flex items-center justify-center bg-black/5 rounded-full ring-1 ring-inset ring-black/10 text-black/70 font-semibold flex-shrink-0 mt-0.5">
                  <span className="text-xs">3</span>
                </div>
                <span>Ensure video sharing is enabled</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 flex items-center justify-center bg-black/5 rounded-full ring-1 ring-inset ring-black/10 text-black/70 font-semibold flex-shrink-0 mt-0.5">
                  <span className="text-xs">4</span>
                </div>
                <span>Double-check the URL before submitting</span>
              </li>
            </ul>
          </div>

          {/* Status Info */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 shadow-md hover:shadow-lg transition-transform duration-300 hover:-translate-y-0.5 ring-1 ring-inset ring-white/60">
            <div className="flex items-start gap-3 mb-3">
              <div className="h-9 w-9 rounded-full bg-purple-500/10 ring-1 ring-inset ring-purple-300/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-purple-900">What Happens Next?</h3>
              </div>
            </div>
            <p className="text-xs text-purple-700 leading-relaxed">
              Once submitted, your video will be queued for review. You will receive feedback on the submission. You can track the status from your dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
