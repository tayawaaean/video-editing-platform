'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { uploadVideoToFirebase, deleteVideoFromFirebase, isFirebaseConfigured, UploadProgress } from '@/lib/firebase';

export default function NewSubmissionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedVideoPath, setUploadedVideoPath] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // General state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const firebaseReady = isFirebaseConfigured();

  const getRoleDashboardPath = () => {
    if (!user) return '/admin/dashboard';
    switch (user.role) {
      case 'admin': return '/admin/dashboard';
      case 'reviewer': return '/reviewer/dashboard';
      case 'submitter': return '/submitter/dashboard';
      default: return '/admin/dashboard';
    }
  };

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }
    
    // Validate file size (150MB max per file)
    const maxSize = 150 * 1024 * 1024; // 150MB
    if (file.size > maxSize) {
      setError('File size must be 150MB or less');
      return;
    }

    setSelectedFile(file);
    setUploadedVideoUrl(null);
    setUploadedVideoPath(null);
    setUploadProgress(null);
    setError(null);
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Upload video to Firebase
  const handleUploadVideo = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);

    try {
      const result = await uploadVideoToFirebase(selectedFile, (progress) => {
        setUploadProgress(progress);
      });

      if (result.success && result.downloadUrl && result.filePath) {
        setUploadedVideoUrl(result.downloadUrl);
        setUploadedVideoPath(result.filePath);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // Submit the form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!uploadedVideoUrl || !uploadedVideoPath || !selectedFile) {
        setError('Please upload a video first');
        setLoading(false);
        return;
      }

      const requestBody = {
        title,
        description,
        video_source: 'firebase' as const,
        firebase_video_url: uploadedVideoUrl,
        firebase_video_path: uploadedVideoPath,
        firebase_video_size: selectedFile.size,
      };

      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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

  // Handle changing the uploaded video (deletes old file from Firebase)
  const handleChangeVideo = async () => {
    // Delete the old file from Firebase if it exists
    if (uploadedVideoPath) {
      try {
        await deleteVideoFromFirebase(uploadedVideoPath);
      } catch (err) {
        console.error('Failed to delete old video:', err);
        // Continue anyway - orphaned file will be cleaned up eventually
      }
    }
    
    // Reset state to allow new upload
    setSelectedFile(null);
    setUploadedVideoUrl(null);
    setUploadedVideoPath(null);
    setUploadProgress(null);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Check if form is valid
  const isFormValid = () => {
    return !!title.trim() && !!uploadedVideoUrl && !!uploadedVideoPath;
  };

  return (
    <div className="w-full">
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
          <div className="bg-white rounded-2xl shadow-md border border-black/10 p-8 hover:shadow-lg transition-shadow duration-300">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
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

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-black mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={4}
                  maxLength={5000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full px-4 py-3 border border-black/20 rounded-xl shadow-sm placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-[#061E26] text-sm resize-none transition-shadow"
                  placeholder="Provide context about this video..."
                />
                <p className="mt-2 text-xs text-black/50">{description.length}/5000 characters</p>
              </div>

              {/* Upload Section - direct file upload only */}
              {firebaseReady && (
                <div className="space-y-4">
                  {/* Drop Zone */}
                  {!uploadedVideoUrl && (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                        isDragging
                          ? 'border-[#061E26] bg-[#061E26]/5'
                          : 'border-black/20 hover:border-black/40'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                      <svg className="w-12 h-12 mx-auto text-black/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-black/60">
                        <span className="font-semibold text-[#061E26]">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-black/40 mt-1">MP4, MOV, WebM up to 150MB</p>
                    </div>
                  )}

                  {/* Selected File Info */}
                  {selectedFile && !uploadedVideoUrl && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#061E26]/10 rounded-lg">
                          <svg className="w-6 h-6 text-[#061E26]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-black truncate">{selectedFile.name}</p>
                          <p className="text-xs text-black/50">{formatFileSize(selectedFile.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setUploadProgress(null);
                          }}
                          className="p-1 text-black/40 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Upload Progress */}
                      {uploadProgress && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-black/60 mb-1">
                            <span>Uploading...</span>
                            <span>{Math.round(uploadProgress.progress)}%</span>
                          </div>
                          <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#061E26] transition-all duration-300"
                              style={{ width: `${uploadProgress.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-black/40 mt-1">
                            {formatFileSize(uploadProgress.bytesTransferred)} / {formatFileSize(uploadProgress.totalBytes)}
                          </p>
                        </div>
                      )}

                      {/* Upload Button */}
                      {!uploadProgress && (
                        <button
                          type="button"
                          onClick={handleUploadVideo}
                          disabled={loading}
                          className="mt-3 w-full py-2 bg-[#061E26] text-white rounded-lg text-sm font-medium hover:bg-[#061E26]/90 transition-colors disabled:opacity-50"
                        >
                          Upload Video
                        </button>
                      )}
                    </div>
                  )}

                  {/* Uploaded Video Preview */}
                  {uploadedVideoUrl && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-800">Video uploaded successfully</p>
                          <p className="text-xs text-green-600">{selectedFile?.name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleChangeVideo}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          Change
                        </button>
                      </div>
                      {/* Video Preview */}
                      <video
                        src={uploadedVideoUrl}
                        controls
                        className="w-full rounded-lg bg-black"
                        style={{ maxHeight: '200px' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {!firebaseReady && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Firebase is not configured. Please contact an administrator to enable video uploads.
                </div>
              )}

              {/* Submit Button */}
              <div className="flex items-center justify-between gap-4 pt-6 border-t border-black/10">
                <Link
                  href={getRoleDashboardPath()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-black/70 hover:text-black transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading || !isFormValid()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#061E26] to-black text-white rounded-xl font-semibold shadow-lg shadow-[#061E26]/30 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Upload Tips */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-md ring-1 ring-inset ring-white/60">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-9 w-9 rounded-full bg-blue-500/10 ring-1 ring-inset ring-blue-300/40 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-blue-900">Direct Upload Benefits</h3>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-blue-800">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Auto-capture frames on pause</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Better video playback quality</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Up to 150MB per file (1GB total storage limit)</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Archived to Google Drive on approval</span>
                </li>
              </ul>
            </div>

          {/* Quick Tips */}
          <div className="bg-white rounded-2xl p-6 border border-black/10 shadow-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-9 w-9 rounded-full bg-[#BA836B]/10 ring-1 ring-inset ring-[#BA836B]/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#BA836B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-black">Quick Tips</h3>
            </div>
            <ul className="space-y-3 text-sm text-black/70">
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 flex items-center justify-center bg-black/5 rounded-full text-xs font-semibold">1</span>
                <span>Choose a clear, descriptive title</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 flex items-center justify-center bg-black/5 rounded-full text-xs font-semibold">2</span>
                <span>Include context in the description</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 flex items-center justify-center bg-black/5 rounded-full text-xs font-semibold">3</span>
                <span>Wait for upload to complete before submitting</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
