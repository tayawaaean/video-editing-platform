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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{submission.title}</h1>
            {submission.description && (
              <p className="mt-1 text-gray-600">{submission.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={submission.status} />
            {canReview && (
              <select
                value={submission.status}
                onChange={(e) => handleStatusChange(e.target.value as SubmissionStatus)}
                disabled={statusUpdating}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                <option value="pending">Pending</option>
                <option value="reviewing">In Review</option>
                <option value="completed">Completed</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <VideoPlayer embedUrl={submission.embed_url} title={submission.title} />
          </div>
        </div>

        {/* Feedback section */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'comments'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Comments ({comments.length})
              </button>
              <button
                onClick={() => setActiveTab('annotations')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'annotations'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Annotations ({annotations.length})
              </button>
            </div>

            {/* Comments tab */}
            {activeTab === 'comments' && (
              <div className="p-4">
                {/* Add comment form */}
                <form onSubmit={handleAddComment} className="mb-4">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="0:00"
                      value={commentTimestamp}
                      onChange={(e) => setCommentTimestamp(e.target.value)}
                      className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-500 self-center">timestamp</span>
                  </div>
                  <textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !newComment.trim()}
                    className="mt-2 w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Adding...' : 'Add Comment'}
                  </button>
                </form>

                {/* Comments list */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {rootComments.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No comments yet</p>
                  ) : (
                    rootComments.map((comment) => (
                      <div key={comment.id} className="border-l-2 border-gray-200 pl-3">
                        <div className="flex items-start gap-2">
                          <button
                            className="text-xs font-mono text-blue-600 hover:text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded"
                            title="Jump to timestamp"
                          >
                            {formatTimestamp(comment.timestamp_seconds)}
                          </button>
                        </div>
                        <p className="text-sm text-gray-900 mt-1">{comment.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{comment.user_email}</span>
                          <button
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Reply
                          </button>
                        </div>

                        {/* Reply form */}
                        {replyingTo === comment.id && (
                          <form onSubmit={(e) => handleAddReply(e, comment.id)} className="mt-2">
                            <textarea
                              placeholder="Write a reply..."
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              rows={2}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                            />
                            <div className="flex gap-2 mt-1">
                              <button
                                type="submit"
                                disabled={submitting || !replyContent.trim()}
                                className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                Reply
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyContent('');
                                }}
                                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Replies */}
                        {getReplies(comment.id).map((reply) => (
                          <div key={reply.id} className="mt-2 ml-4 border-l-2 border-gray-100 pl-3">
                            <p className="text-sm text-gray-900">{reply.content}</p>
                            <span className="text-xs text-gray-500">{reply.user_email}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Annotations tab */}
            {activeTab === 'annotations' && (
              <div className="p-4">
                {/* Add annotation form (reviewer only) */}
                {canReview && (
                  <form onSubmit={handleAddAnnotation} className="mb-4">
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="0:00"
                        value={annotationTimestamp}
                        onChange={(e) => setAnnotationTimestamp(e.target.value)}
                        className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-sm text-gray-500 self-center">timestamp</span>
                    </div>
                    <textarea
                      placeholder="Add a review note..."
                      value={newAnnotation}
                      onChange={(e) => setNewAnnotation(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={submitting || !newAnnotation.trim()}
                      className="mt-2 w-full px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? 'Adding...' : 'Add Annotation'}
                    </button>
                  </form>
                )}

                {!canReview && (
                  <p className="text-sm text-gray-500 mb-4 p-2 bg-gray-50 rounded">
                    Only reviewers can add annotations
                  </p>
                )}

                {/* Annotations list */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {annotations.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No annotations yet</p>
                  ) : (
                    annotations.map((annotation) => (
                      <div key={annotation.id} className="bg-purple-50 border border-purple-200 rounded-md p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            className="text-xs font-mono text-purple-600 hover:text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded"
                            title="Jump to timestamp"
                          >
                            {formatTimestamp(annotation.timestamp_seconds)}
                          </button>
                          <span className="text-xs text-purple-600">Reviewer Note</span>
                        </div>
                        <p className="text-sm text-gray-900">{annotation.note}</p>
                        <span className="text-xs text-gray-500 mt-1 block">{annotation.reviewer_email}</span>
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
