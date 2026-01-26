'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseGoogleDriveUrl } from '@/lib/google-drive';

export default function NewSubmissionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">New Submission</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Enter a title for your video"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              rows={4}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
              placeholder="Add any context or notes about this video"
            />
            <p className="mt-1 text-xs text-gray-500">{description.length}/5000 characters</p>
          </div>

          <div>
            <label htmlFor="googleDriveUrl" className="block text-sm font-medium text-gray-700">
              Google Drive Video URL <span className="text-red-500">*</span>
            </label>
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
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm ${
                urlError ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="https://drive.google.com/file/d/.../view"
            />
            {urlError && (
              <p className="mt-1 text-sm text-red-600">{urlError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Paste a Google Drive sharing link. Make sure the video is set to &quot;Anyone with the link can view&quot;.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Supported URL formats:</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• https://drive.google.com/file/d/FILE_ID/view</li>
              <li>• https://drive.google.com/open?id=FILE_ID</li>
              <li>• https://drive.google.com/uc?id=FILE_ID</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Submission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
