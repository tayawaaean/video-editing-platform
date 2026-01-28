'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge, PageLoading } from '@/components';
import { VideoPlayer } from '@/components/VideoPlayer';
import { formatTimestamp } from '@/lib/google-drive';
import type { Submission, Comment, SubmissionStatus } from '@/types';

interface SubmissionDetailClientProps {
  submissionId: string;
}

export function SubmissionDetailClient({ submissionId }: SubmissionDetailClientProps) {
  const { user } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState('');
  const [commentTimestamp, setCommentTimestamp] = useState('0:00');
  const [commentAttachment, setCommentAttachment] = useState<File | null>(null);
  const [commentAttachmentPreview, setCommentAttachmentPreview] = useState<string | null>(null);
  const [commentAttachmentDataUrl, setCommentAttachmentDataUrl] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyTimestamp, setReplyTimestamp] = useState('0:00');
  const [replyAttachment, setReplyAttachment] = useState<File | null>(null);
  const [replyAttachmentPreview, setReplyAttachmentPreview] = useState<string | null>(null);
  const [showTimestampModal, setShowTimestampModal] = useState(false);
  const [isReplyTimestamp, setIsReplyTimestamp] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [frameCapturing, setFrameCapturing] = useState(false);
  const [frameCaptureError, setFrameCaptureError] = useState<string | null>(null);

  const canReview = user?.role === 'reviewer' || user?.role === 'admin';

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

  const fetchSubmission = useCallback(async () => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}`);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load submission');
      setSubmission(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    }
  }, [submissionId]);

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/comments?submission_id=${submissionId}`);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch comments');
      setComments(data.data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  }, [submissionId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSubmission(), fetchComments()]);
    setLoading(false);
  }, [fetchSubmission, fetchComments]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchComments();
      fetchSubmission();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchComments, fetchSubmission]);

  const parseTimestampInput = (input: string): number => {
    const parts = input.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const formatTimestampFromSeconds = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimestampCapture = (seconds: number) => {
    const formatted = formatTimestampFromSeconds(seconds);
    if (isReplyTimestamp) setReplyTimestamp(formatted);
    else setCommentTimestamp(formatted);
    setShowTimestampModal(false);
  };

  const handleCaptureClick = () => {
    const capture = (window as Window & { __captureVideoTime?: () => void }).__captureVideoTime;
    if (typeof capture === 'function') {
      capture();
    }
    setIsReplyTimestamp(false);
    setShowTimestampModal(true);
  };

  const handleReplyCaptureClick = () => {
    const capture = (window as Window & { __captureVideoTime?: () => void }).__captureVideoTime;
    if (typeof capture === 'function') {
      capture();
    }
    setIsReplyTimestamp(true);
    setShowTimestampModal(true);
  };

  const handleFrameCapture = useCallback((payload: { timestamp_seconds: number; imageDataUrl: string }) => {
    setCommentTimestamp(formatTimestampFromSeconds(payload.timestamp_seconds));
    setCommentAttachmentPreview(payload.imageDataUrl);
    setCommentAttachmentDataUrl(payload.imageDataUrl);
    setCommentAttachment(null);
  }, []);

  const handleCaptureFrameClick = async () => {
    const capture = (window as Window & { __captureFrame?: () => boolean }).__captureFrame;
    if (typeof capture === 'function' && capture()) {
      setFrameCaptureError(null);
      return;
    }
    const seconds = parseTimestampInput(commentTimestamp);
    if (seconds === 0) {
      setFrameCaptureError('Enter the video timestamp first (e.g. 1:30), then click Capture frame again.');
      setShowTimestampModal(true);
      setIsReplyTimestamp(false);
      return;
    }
    setFrameCaptureError(null);
    setFrameCapturing(true);
    try {
      const response = await fetch(`/api/submissions/${submissionId}/frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp_seconds: seconds }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Frame capture failed');
      }
      if (data.imageDataUrl != null && typeof data.timestamp_seconds === 'number') {
        setCommentTimestamp(formatTimestampFromSeconds(data.timestamp_seconds));
        setCommentAttachmentPreview(data.imageDataUrl);
        setCommentAttachmentDataUrl(data.imageDataUrl);
        setCommentAttachment(null);
      }
    } catch (err) {
      setFrameCaptureError(err instanceof Error ? err.message : 'Frame capture failed');
    } finally {
      setFrameCapturing(false);
    }
  };

  const handlePasteScreenshot = async () => {
    setFrameCaptureError(null);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t === 'image/png' || t === 'image/jpeg' || t === 'image/webp');
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        setCommentAttachmentPreview(dataUrl);
        setCommentAttachmentDataUrl(dataUrl);
        setCommentAttachment(null);
        return;
      }
      setFrameCaptureError('No image in clipboard. Pause the video, take a screenshot (e.g. Win+Shift+S or Cmd+Shift+4), then click Paste screenshot again.');
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setFrameCaptureError('Clipboard access denied. Allow paste when the browser prompts, then try again.');
      } else {
        setFrameCaptureError(err instanceof Error ? err.message : 'Could not read screenshot from clipboard.');
      }
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>, isReply = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isReply) {
        setReplyAttachmentPreview(reader.result as string);
        setReplyAttachment(file);
      } else {
        setCommentAttachmentPreview(reader.result as string);
        setCommentAttachment(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (isReply = false) => {
    if (isReply) {
      setReplyAttachment(null);
      setReplyAttachmentPreview(null);
    } else {
      setCommentAttachment(null);
      setCommentAttachmentPreview(null);
      setCommentAttachmentDataUrl(null);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && !commentAttachment && !commentAttachmentDataUrl) return;
    setSubmitting(true);
    try {
      let attachmentUrl: string | undefined;
      if (commentAttachmentDataUrl) {
        attachmentUrl = commentAttachmentDataUrl;
      } else if (commentAttachment) {
        attachmentUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(commentAttachment);
        });
      }
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          content: newComment.trim() || '',
          timestamp_seconds: parseTimestampInput(commentTimestamp),
          attachment_url: attachmentUrl,
        }),
      });
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setComments(prev => [...prev, data.data]);
      setNewComment('');
      setCommentTimestamp('0:00');
      setCommentAttachment(null);
      setCommentAttachmentPreview(null);
      setCommentAttachmentDataUrl(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!replyContent.trim() && !replyAttachment) return;
    setSubmitting(true);
    try {
      const parentComment = comments.find(c => c.id === parentId);
      const timestamp = replyTimestamp && replyTimestamp !== '0:00'
        ? parseTimestampInput(replyTimestamp)
        : (parentComment?.timestamp_seconds ?? 0);
      let attachmentUrl: string | undefined;
      if (replyAttachment) {
        attachmentUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(replyAttachment);
        });
      }
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          content: replyContent.trim() || '',
          timestamp_seconds: timestamp,
          parent_comment_id: parentId,
          attachment_url: attachmentUrl,
        }),
      });
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setComments(prev => [...prev, data.data]);
      setReplyContent('');
      setReplyTimestamp('0:00');
      setReplyAttachment(null);
      setReplyAttachmentPreview(null);
      setReplyingTo(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add reply');
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
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSubmission(data.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const rootComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_comment_id === parentId);

  const ReplyThread = ({ reply, depth = 0 }: { reply: Comment; depth?: number }) => {
    const replies = getReplies(reply.id);
    const isReplying = replyingTo === reply.id;
    return (
      <div className={depth > 0 ? 'ml-6' : ''}>
        <div className="p-3 bg-white rounded-lg border border-black/10">
          <div className="flex items-start justify-between mb-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#061E26] hover:text-black bg-[#061E26]/10 hover:bg-[#061E26]/20 px-2.5 py-1.5 rounded-md transition-colors shadow-sm"
              title="Jump to timestamp"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold">{formatTimestamp(reply.timestamp_seconds)}</span>
            </button>
          </div>
          <p className="text-sm text-black leading-relaxed">{reply.content}</p>
          {reply.attachment_url && (
            <div className="mt-2">
              {reply.attachment_url.startsWith('data:image/') ? (
                <img src={reply.attachment_url} alt="Attachment" className="max-w-full max-h-48 rounded-lg border border-black/10" />
              ) : reply.attachment_url.startsWith('data:') ? (
                <a href={reply.attachment_url} download className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg transition-colors border border-[#061E26]/20">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download Attachment</span>
                </a>
              ) : null}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-black/10">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-5 h-5 bg-gradient-to-br from-[#BA836B] to-[#061E26] rounded-full flex items-center justify-center text-white text-xs font-bold">
                {reply.user_email?.charAt(0).toUpperCase() ?? 'U'}
              </div>
              <span className="text-xs text-black/60">{reply.user_email ?? 'Unknown User'}</span>
              <span className="text-xs text-black/40">-</span>
              <span className="text-xs text-black/50" title={new Date(reply.created_at).toLocaleString()}>
                {new Date(reply.created_at).toLocaleDateString()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setReplyingTo(isReplying ? null : reply.id); setReplyTimestamp('0:00'); setReplyContent(''); }}
              className="text-xs font-medium text-[#061E26] hover:text-black hover:underline"
            >
              {isReplying ? 'Cancel' : 'Reply'}
            </button>
          </div>
          {isReplying && (
            <form onSubmit={(e) => handleAddReply(e, reply.id)} className="mt-3 p-3 bg-gradient-to-br from-white to-[#061E26]/5 rounded-lg border border-black/10">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  placeholder="0:00"
                  value={replyTimestamp}
                  onChange={(e) => setReplyTimestamp(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs font-mono border border-black/20 rounded-md focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent"
                />
                <button type="button" onClick={handleReplyCaptureClick} className="px-2 py-1.5 text-xs font-medium text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-md transition-colors" title="Capture current video time">
                  Capture
                </button>
              </div>
              <textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={2}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button type="submit" disabled={submitting || !replyContent.trim()} className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#061E26] to-black rounded-md hover:shadow-md disabled:opacity-50 transition-all">
                  Reply
                </button>
                <button type="button" onClick={() => { setReplyingTo(null); setReplyContent(''); setReplyTimestamp('0:00'); }} className="px-3 py-1.5 text-xs font-medium text-black/60 hover:text-black hover:bg-black/5 rounded-md transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
          {replies.length > 0 && (
            <div className="mt-3 space-y-2">
              {replies.map((nestedReply) => (
                <ReplyThread key={nestedReply.id} reply={nestedReply} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <PageLoading />;
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{error}</div>
      </div>
    );
  }
  if (!submission) return null;

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-6">
      <div className="mb-6">
        <Link href={getRoleDashboardPath()} className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors mb-4 group">
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
                  {submission.description && <p className="text-gray-600 leading-relaxed">{submission.description}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Created {new Date(submission.created_at).toLocaleDateString()}</span>
                </div>
                <span className="text-gray-300">-</span>
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
                    className="appearance-none px-4 py-2 pr-10 text-sm font-medium border border-black/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="aspect-video bg-gray-100">
              <VideoPlayer
                embedUrl={submission.embed_url}
                title={submission.title}
                onTimestampCapture={handleTimestampCapture}
                onCaptureRequest={handleCaptureClick}
                onFrameCapture={handleFrameCapture}
              />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-[#061E26]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h2 className="text-lg font-bold text-black">Add Feedback</h2>
              </div>
              <form onSubmit={handleAddComment} className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="0:00"
                    value={commentTimestamp}
                    onChange={(e) => setCommentTimestamp(e.target.value)}
                    className="flex-1 min-w-[80px] px-3 py-2.5 text-sm font-mono border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent"
                  />
                  <button type="button" onClick={handleCaptureClick} className="px-3 py-2.5 text-xs font-medium text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg transition-colors border border-[#061E26]/20" title="Set timestamp (manual or from player if supported)">
                    Capture time
                  </button>
                  <button type="button" onClick={handleCaptureFrameClick} disabled={frameCapturing} className="px-3 py-2.5 text-xs font-medium text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg transition-colors border border-[#061E26]/20 disabled:opacity-50 disabled:cursor-not-allowed" title="Snapshot frame at timestamp (direct video: in-browser; Drive: enter time then click, uses server)">
                    {frameCapturing ? 'Capturing...' : 'Capture frame'}
                  </button>
                  <button type="button" onClick={handlePasteScreenshot} className="px-3 py-2.5 text-xs font-medium text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg transition-colors border border-[#061E26]/20" title="Paste a screenshot from clipboard (pause video, take screenshot with Win+Shift+S or Cmd+Shift+4, then click here)">
                    Paste screenshot
                  </button>
                </div>
                {frameCaptureError && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{frameCaptureError}</p>
                )}
                <p className="text-xs text-black/50">
                  Paste screenshot: pause the video at the frame you want, take a screenshot (Win+Shift+S or Cmd+Shift+4), then click Paste screenshot. Set the timestamp above and add your comment.
                </p>
                <textarea
                  placeholder="Share your feedback or ask a question..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 text-sm border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent resize-none"
                />
                <div className="space-y-2">
                  <label className="block">
                    <input type="file" onChange={(e) => handleAttachmentChange(e, false)} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx" />
                    <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg cursor-pointer transition-colors border border-[#061E26]/20">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span>Attach File</span>
                    </div>
                  </label>
                  {commentAttachmentPreview && (
                    <div className="relative p-3 bg-black/5 rounded-lg border border-black/10">
                      <button type="button" onClick={() => removeAttachment(false)} className="absolute top-2 right-2 p-1 text-black/60 hover:text-black rounded-full hover:bg-black/10 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {commentAttachment?.type.startsWith('image/') ? (
                        <img src={commentAttachmentPreview} alt="Preview" className="max-w-full max-h-32 rounded" />
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-black/70">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>{commentAttachment?.name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting || (!newComment.trim() && !commentAttachment && !commentAttachmentDataUrl)}
                  className="w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#061E26] to-black rounded-lg hover:shadow-lg hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shadow-md"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Adding...
                    </span>
                  ) : 'Post Feedback'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-[#061E26]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h2 className="text-lg font-bold text-black">Feedback</h2>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-[#061E26]/10 text-[#061E26] rounded-full">{comments.length}</span>
              </div>
              <div className="space-y-4 max-h-[1200px] overflow-y-auto pr-1 custom-scrollbar">
                {rootComments.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm text-black/60 mt-2">No feedback yet</p>
                    <p className="text-xs text-black/40 mt-1">Be the first to share your thoughts</p>
                  </div>
                ) : (
                  rootComments.map((comment) => (
                    <div key={comment.id} className="bg-gradient-to-br from-white to-black/5 rounded-lg p-4 border border-black/10 hover:border-[#061E26]/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#061E26] hover:text-black bg-[#061E26]/10 hover:bg-[#061E26]/20 px-2.5 py-1 rounded-md transition-colors"
                          title="Jump to timestamp"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTimestamp(comment.timestamp_seconds)}
                        </button>
                      </div>
                      <p className="text-sm text-black leading-relaxed">{comment.content}</p>
                      {comment.attachment_url && (
                        <div className="mt-2">
                          {comment.attachment_url.startsWith('data:image/') ? (
                            <img src={comment.attachment_url} alt="Attachment" className="max-w-full max-h-48 rounded-lg border border-black/10" />
                          ) : comment.attachment_url.startsWith('data:') ? (
                            <a href={comment.attachment_url} download className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg transition-colors border border-[#061E26]/20">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>Download Attachment</span>
                            </a>
                          ) : null}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-black/10">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-6 h-6 bg-gradient-to-br from-[#061E26] to-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {comment.user_email?.charAt(0).toUpperCase() ?? 'U'}
                          </div>
                          <span className="text-xs font-medium text-black/70">{comment.user_email ?? 'Unknown User'}</span>
                          <span className="text-xs text-black/40">-</span>
                          <span className="text-xs text-black/50" title={new Date(comment.created_at).toLocaleString()}>
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                          className="text-xs font-medium text-[#061E26] hover:text-black hover:underline"
                        >
                          {replyingTo === comment.id ? 'Cancel' : 'Reply'}
                        </button>
                      </div>
                      {replyingTo === comment.id && (
                        <form onSubmit={(e) => handleAddReply(e, comment.id)} className="mt-3 p-3 bg-gradient-to-br from-white to-[#061E26]/5 rounded-lg border border-black/10">
                          <div className="flex items-center gap-2 mb-2">
                            <input type="text" placeholder="0:00" value={replyTimestamp} onChange={(e) => setReplyTimestamp(e.target.value)} className="w-20 px-2 py-1.5 text-xs font-mono border border-black/20 rounded-md focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent" />
                            <span className="text-xs text-black/50">Timestamp (optional)</span>
                          </div>
                          <textarea placeholder="Write a reply..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows={2} autoFocus className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent resize-none" />
                          <div className="flex gap-2 mt-2">
                            <button type="submit" disabled={submitting || !replyContent.trim()} className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#061E26] to-black rounded-md hover:shadow-md disabled:opacity-50 transition-all">Reply</button>
                            <button type="button" onClick={() => { setReplyingTo(null); setReplyContent(''); setReplyTimestamp('0:00'); }} className="px-3 py-1.5 text-xs font-medium text-black/60 hover:text-black hover:bg-black/5 rounded-md transition-colors">Cancel</button>
                          </div>
                        </form>
                      )}
                      {getReplies(comment.id).length > 0 && (
                        <div className="mt-3 space-y-2">
                          {getReplies(comment.id).map((reply) => (
                            <ReplyThread key={reply.id} reply={reply} depth={1} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTimestampModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTimestampModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-black mb-4">Enter Video Timestamp</h3>
            <p className="text-sm text-black/60 mb-4">
              Enter the current video time in MM:SS or HH:MM:SS format. For embedded videos (e.g. Google Drive), take a screenshot of the frame (e.g. Win+Shift+S), then use Attach File in the form to add it.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Timestamp</label>
                <input
                  type="text"
                  value={isReplyTimestamp ? replyTimestamp : commentTimestamp}
                  onChange={(e) => (isReplyTimestamp ? setReplyTimestamp(e.target.value) : setCommentTimestamp(e.target.value))}
                  placeholder="0:00 or 1:23:45"
                  className="w-full px-4 py-2.5 text-sm font-mono border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowTimestampModal(false)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#061E26] to-black rounded-lg hover:shadow-lg transition-all">
                  Use Timestamp
                </button>
                <button type="button" onClick={() => setShowTimestampModal(false)} className="px-4 py-2.5 text-sm font-medium text-black/60 hover:text-black hover:bg-black/5 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
