'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge, PageLoading } from '@/components';
import { VideoPlayer } from '@/components/VideoPlayer';
import { formatTimestamp } from '@/lib/google-drive';
import type { Submission, Comment, Annotation, SubmissionStatus } from '@/types';

interface SubmissionDetailClientProps {
  submissionId: string;
}

export function SubmissionDetailClient({ submissionId }: SubmissionDetailClientProps) {
  const { user } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  const getRoleDashboardPath = () => {
    if (!user) return '/dashboard';
    switch (user.role) {
      case 'admin':
        return '/admin/dashboard';
      case 'reviewer':
        return '/reviewer/dashboard';
      case 'submitter':
        return '/submitter/dashboard';
      default:
        return '/dashboard';
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'comments' | 'annotations'>('comments');
  
  // Form states
  const [newComment, setNewComment] = useState('');
  const [commentTimestamp, setCommentTimestamp] = useState('0:00');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  
  const [newAnnotation, setNewAnnotation] = useState('');
  const [annotationTimestamp, setAnnotationTimestamp] = useState('0:00');
  
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const canReview = user?.role === 'reviewer' || user?.role === 'admin';

  const fetchSubmission = useCallback(async () => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSubmission(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    }
  }, [submissionId]);

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/comments?submission_id=${submissionId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setComments(data.data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  }, [submissionId]);

  const fetchAnnotations = useCallback(async () => {
    try {
      const response = await fetch(`/api/annotations?submission_id=${submissionId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAnnotations(data.data);
    } catch (err) {
      console.error('Failed to fetch annotations:', err);
    }
  }, [submissionId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSubmission(), fetchComments(), fetchAnnotations()]);
    setLoading(false);
  }, [fetchSubmission, fetchComments, fetchAnnotations]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Polling for updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchComments();
      fetchAnnotations();
      fetchSubmission();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchComments, fetchAnnotations, fetchSubmission]);

  const parseTimestampInput = (input: string): number => {
    const parts = input.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          content: newComment,
          timestamp_seconds: parseTimestampInput(commentTimestamp),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setComments(prev => [...prev, data.data]);
      setNewComment('');
      setCommentTimestamp('0:00');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    setSubmitting(true);
    try {
      const parentComment = comments.find(c => c.id === parentId);
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          content: replyContent,
          timestamp_seconds: parentComment?.timestamp_seconds || 0,
          parent_comment_id: parentId,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setComments(prev => [...prev, data.data]);
      setReplyContent('');
      setReplyingTo(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnotation.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          note: newAnnotation,
          timestamp_seconds: parseTimestampInput(annotationTimestamp),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setAnnotations(prev => [...prev, data.data]);
      setNewAnnotation('');
      setAnnotationTimestamp('0:00');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add annotation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: SubmissionStatus) => {
    setStatusUpdating(true);
    try {
      const response = await fetch(`/api/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSubmission(data.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Build threaded comments
  const rootComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_comment_id === parentId);

  if (loading) return <PageLoading />;
  
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  if (!submission) return null;

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={getRoleDashboardPath()}
          className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors mb-4 group"
        >
          <svg className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 mb-2">
                <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">{submission.title}</h1>
                  {submission.description && (
                    <p className="text-gray-600 leading-relaxed">{submission.description}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Created {new Date(submission.created_at).toLocaleDateString()}</span>
                </div>
                <span className="text-gray-300">•</span>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Updated {new Date(submission.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <StatusBadge status={submission.status} />
              {canReview && (
                <div className="relative">
                  <select
                    value={submission.status}
                    onChange={(e) => handleStatusChange(e.target.value as SubmissionStatus)}
                    disabled={statusUpdating}
                    className="appearance-none px-4 py-2 pr-10 text-sm font-medium border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <option value="pending">Move to Pending</option>
                    <option value="reviewing">Move to In Review</option>
                    <option value="completed">Move to Completed</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Video section */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="aspect-video bg-gray-100">
              <VideoPlayer embedUrl={submission.embed_url} title={submission.title} />
            </div>
          </div>
        </div>

        {/* Feedback section */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex-1 px-4 py-3.5 text-sm font-semibold transition-all relative ${
                  activeTab === 'comments'
                    ? 'text-blue-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>Comments</span>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-600 rounded-full">
                    {comments.length}
                  </span>
                </div>
                {activeTab === 'comments' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab('annotations')}
                className={`flex-1 px-4 py-3.5 text-sm font-semibold transition-all relative ${
                  activeTab === 'annotations'
                    ? 'text-purple-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <span>Annotations</span>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-600 rounded-full">
                    {annotations.length}
                  </span>
                </div>
                {activeTab === 'annotations' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
                )}
              </button>
            </div>

            {/* Comments tab */}
            {activeTab === 'comments' && (
              <div className="p-5">
                {/* Add comment form */}
                <form onSubmit={handleAddComment} className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add a comment</label>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-shrink-0">
                      <input
                        type="text"
                        placeholder="0:00"
                        value={commentTimestamp}
                        onChange={(e) => setCommentTimestamp(e.target.value)}
                        className="w-24 px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-600 font-medium">Timestamp</span>
                  </div>
                  <textarea
                    placeholder="Share your feedback..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !newComment.trim()}
                    className="mt-3 w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding...
                      </span>
                    ) : 'Post Comment'}
                  </button>
                </form>

                {/* Comments list */}
                <div className="space-y-4 max-h-[1200px] overflow-y-auto pr-1 custom-scrollbar">
                  {rootComments.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-sm text-gray-500 mt-2">No comments yet</p>
                      <p className="text-xs text-gray-400 mt-1">Be the first to comment</p>
                    </div>
                  ) : (
                    rootComments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-200 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <button
                            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-md transition-colors"
                            title="Jump to timestamp"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatTimestamp(comment.timestamp_seconds)}
                          </button>
                        </div>
                        <p className="text-sm text-gray-900 leading-relaxed">{comment.content}</p>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {comment.user_email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <span className="text-xs font-medium text-gray-600">{comment.user_email || 'Unknown User'}</span>
                          </div>
                          <button
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {replyingTo === comment.id ? 'Cancel' : 'Reply'}
                          </button>
                        </div>

                        {/* Reply form */}
                        {replyingTo === comment.id && (
                          <form onSubmit={(e) => handleAddReply(e, comment.id)} className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                            <textarea
                              placeholder="Write a reply..."
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              rows={2}
                              autoFocus
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                type="submit"
                                disabled={submitting || !replyContent.trim()}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                Reply
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyContent('');
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Replies */}
                        {getReplies(comment.id).length > 0 && (
                          <div className="mt-3 space-y-2">
                            {getReplies(comment.id).map((reply) => (
                              <div key={reply.id} className="ml-6 p-3 bg-white rounded-lg border border-gray-200">
                                <p className="text-sm text-gray-900 leading-relaxed">{reply.content}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {reply.user_email?.charAt(0).toUpperCase() || 'U'}
                                  </div>
                                  <span className="text-xs text-gray-500">{reply.user_email || 'Unknown User'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Annotations tab */}
            {activeTab === 'annotations' && (
              <div className="p-5">
                {/* Add annotation form (reviewer only) */}
                {canReview && (
                  <form onSubmit={handleAddAnnotation} className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Add a review annotation</label>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative flex-shrink-0">
                        <input
                          type="text"
                          placeholder="0:00"
                          value={annotationTimestamp}
                          onChange={(e) => setAnnotationTimestamp(e.target.value)}
                          className="w-24 px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-600 font-medium">Timestamp</span>
                    </div>
                    <textarea
                      placeholder="Add review notes or feedback..."
                      value={newAnnotation}
                      onChange={(e) => setNewAnnotation(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                    <button
                      type="submit"
                      disabled={submitting || !newAnnotation.trim()}
                      className="mt-3 w-full px-4 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Adding...
                        </span>
                      ) : 'Add Annotation'}
                    </button>
                  </form>
                )}

                {!canReview && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Reviewer Only Feature</p>
                        <p className="text-xs text-gray-500 mt-1">Only reviewers and admins can add annotations to submissions.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Annotations list */}
                <div className="space-y-3 max-h-[1200px] overflow-y-auto pr-1 custom-scrollbar">
                  {annotations.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <p className="text-sm text-gray-500 mt-2">No annotations yet</p>
                      <p className="text-xs text-gray-400 mt-1">Reviewer notes will appear here</p>
                    </div>
                  ) : (
                    annotations.map((annotation) => (
                      <div key={annotation.id} className="bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                          <button
                            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-purple-700 hover:text-purple-900 bg-purple-200 hover:bg-purple-300 px-2.5 py-1 rounded-md transition-colors"
                            title="Jump to timestamp"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatTimestamp(annotation.timestamp_seconds)}
                          </button>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-200 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Reviewer Note
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 leading-relaxed mb-3">{annotation.note}</p>
                        <div className="flex items-center gap-2 pt-3 border-t border-purple-200">
                          <div className="w-6 h-6 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {annotation.reviewer_email?.charAt(0).toUpperCase() || 'R'}
                          </div>
                          <span className="text-xs font-medium text-purple-900">{annotation.reviewer_email || 'Unknown Reviewer'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
