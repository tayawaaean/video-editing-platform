'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge, PageLoading } from '@/components';
import { VideoPlayer } from '@/components/VideoPlayer';
import { FrameAnnotationEditor } from '@/components/FrameAnnotationEditor';
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
  const [replyAttachmentDataUrl, setReplyAttachmentDataUrl] = useState<string | null>(null);
  const [commentPinX, setCommentPinX] = useState<number | null>(null);
  const [commentPinY, setCommentPinY] = useState<number | null>(null);
  const [commentPinComment, setCommentPinComment] = useState<string | null>(null);
  const [replyPinX, setReplyPinX] = useState<number | null>(null);
  const [replyPinY, setReplyPinY] = useState<number | null>(null);
  const [replyPinComment, setReplyPinComment] = useState<string | null>(null);
  const [showTimestampModal, setShowTimestampModal] = useState(false);
  const [isReplyTimestamp, setIsReplyTimestamp] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [frameCapturing, setFrameCapturing] = useState(false);
  const [frameCaptureError, setFrameCaptureError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const roleLower = user?.role?.toLowerCase();
  const isAdmin = roleLower === 'admin';
  const canReview = roleLower === 'reviewer' || isAdmin;
  const canPostFeedback = canReview && submission?.status !== 'approved';
  
  // Check if submission can be archived (admin only, approved status, firebase source)
  const canArchive = isAdmin && 
    submission?.status === 'approved' && 
    submission?.video_source === 'firebase' &&
    submission?.firebase_video_path;

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

  // Check if auto-archive is in progress (approved + still on firebase)
  const isAutoArchiving = submission?.status === 'approved' &&
    submission?.video_source === 'firebase' &&
    !!submission?.firebase_video_path;

  // Retry archive submission to Google Drive (manual retry for admins)
  const handleArchive = async () => {
    if (!canArchive || archiving) return;

    setArchiving(true);
    setArchiveError(null);

    try {
      const response = await fetch(`/api/submissions/${submissionId}/archive`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to archive submission');
      }

      // Refresh submission data
      await fetchSubmission();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive';
      setArchiveError(errorMessage);
      console.error('Archive error:', err);
    } finally {
      setArchiving(false);
    }
  };

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

  // State for screenshot capture modal (for Google Drive embeds)
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [capturedTimestamp, setCapturedTimestamp] = useState<number>(0);

  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [annotationImageDataUrl, setAnnotationImageDataUrl] = useState<string | null>(null);
  const [annotationIsReply, setAnnotationIsReply] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const handleFrameCapture = useCallback((payload: { timestamp_seconds: number; imageDataUrl: string }) => {
    const timestampStr = formatTimestampFromSeconds(payload.timestamp_seconds);
    const hasImage = !!payload.imageDataUrl;

    if (replyingTo) {
      setReplyTimestamp(timestampStr);
      if (hasImage) {
        setReplyAttachmentPreview(payload.imageDataUrl);
        setReplyAttachmentDataUrl(payload.imageDataUrl);
        setReplyAttachment(null);
      } else {
        setReplyAttachmentPreview(null);
        setReplyAttachmentDataUrl(null);
      }
    } else {
      setCommentTimestamp(timestampStr);
      if (hasImage) {
        setCommentAttachmentPreview(payload.imageDataUrl);
        setCommentAttachmentDataUrl(payload.imageDataUrl);
        setCommentAttachment(null);
      } else {
        setCommentAttachmentPreview(null);
        setCommentAttachmentDataUrl(null);
      }
    }
    setFrameCaptureError(null);
  }, [replyingTo]);

  // Single "Capture Frame" button handler - smart behavior based on video type
  const handleCaptureFrameClick = async () => {
    setFrameCaptureError(null);
    
    // Try native video capture first (works for direct video elements)
    const capture = (window as Window & { __captureFrame?: () => boolean }).__captureFrame;
    if (typeof capture === 'function' && capture()) {
      return; // Success - frame was captured from native video
    }
    
    // For Google Drive embeds, show screenshot modal
    // First, try to get current timestamp from the player
    const captureTime = (window as Window & { __captureVideoTime?: () => void }).__captureVideoTime;
    if (typeof captureTime === 'function') {
      captureTime();
    }
    
    // Store current timestamp (from input or 0)
    const currentSeconds = parseTimestampInput(commentTimestamp);
    setCapturedTimestamp(currentSeconds);
    setShowScreenshotModal(true);
  };

  // Handle paste from clipboard (used in screenshot modal)
  const handlePasteFromClipboard = async () => {
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
        // Use captured timestamp
        if (capturedTimestamp > 0) {
          setCommentTimestamp(formatTimestampFromSeconds(capturedTimestamp));
        }
        setShowScreenshotModal(false);
        return;
      }
      setFrameCaptureError('No image found in clipboard. Take a screenshot first, then click "Paste Screenshot".');
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setFrameCaptureError('Clipboard access denied. Please allow clipboard access when prompted.');
      } else {
        setFrameCaptureError(err instanceof Error ? err.message : 'Could not read from clipboard.');
      }
    }
  };

  // Legacy handlers for backward compatibility
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
      setReplyAttachmentDataUrl(null);
      setReplyPinX(null);
      setReplyPinY(null);
      setReplyPinComment(null);
    } else {
      setCommentAttachment(null);
      setCommentAttachmentPreview(null);
      setCommentAttachmentDataUrl(null);
      setCommentPinX(null);
      setCommentPinY(null);
      setCommentPinComment(null);
    }
  };

  const openAnnotationEditor = (isReply: boolean) => {
    const dataUrl = isReply
      ? (replyAttachmentDataUrl || replyAttachmentPreview)
      : (commentAttachmentDataUrl || commentAttachmentPreview);
    if (!dataUrl) return;
    setAnnotationImageDataUrl(dataUrl);
    setAnnotationIsReply(isReply);
    setShowAnnotationModal(true);
  };

  const handleAnnotationSave = (result: { annotatedDataUrl: string; pinX?: number; pinY?: number; pinComment?: string }) => {
    if (annotationIsReply) {
      setReplyAttachmentPreview(result.annotatedDataUrl);
      setReplyAttachmentDataUrl(result.annotatedDataUrl);
      setReplyAttachment(null);
      if (result.pinX != null && result.pinY != null) {
        setReplyPinX(result.pinX);
        setReplyPinY(result.pinY);
        setReplyPinComment(result.pinComment || null);
      } else {
        setReplyPinX(null);
        setReplyPinY(null);
        setReplyPinComment(null);
      }
    } else {
      setCommentAttachmentPreview(result.annotatedDataUrl);
      setCommentAttachmentDataUrl(result.annotatedDataUrl);
      setCommentAttachment(null);
      if (result.pinX != null && result.pinY != null) {
        setCommentPinX(result.pinX);
        setCommentPinY(result.pinY);
        setCommentPinComment(result.pinComment || null);
      } else {
        setCommentPinX(null);
        setCommentPinY(null);
        setCommentPinComment(null);
      }
    }
    setShowAnnotationModal(false);
    setAnnotationImageDataUrl(null);
  };

  const handleAnnotationCancel = () => {
    setShowAnnotationModal(false);
    setAnnotationImageDataUrl(null);
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
          ...(commentPinX != null && commentPinY != null && { attachment_pin_x: commentPinX, attachment_pin_y: commentPinY }),
          ...(commentPinComment && { attachment_pin_comment: commentPinComment }),
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
      setCommentPinX(null);
      setCommentPinY(null);
      setCommentPinComment(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!replyContent.trim() && !replyAttachment && !replyAttachmentDataUrl) return;
    setSubmitting(true);
    try {
      const parentComment = comments.find(c => c.id === parentId);
      const timestamp = replyTimestamp && replyTimestamp !== '0:00'
        ? parseTimestampInput(replyTimestamp)
        : (parentComment?.timestamp_seconds ?? 0);
      let attachmentUrl: string | undefined;
      if (replyAttachmentDataUrl) {
        attachmentUrl = replyAttachmentDataUrl;
      } else if (replyAttachment) {
        attachmentUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(replyAttachment!);
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
          ...(replyPinX != null && replyPinY != null && { attachment_pin_x: replyPinX, attachment_pin_y: replyPinY }),
          ...(replyPinComment && { attachment_pin_comment: replyPinComment }),
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
      setReplyAttachmentDataUrl(null);
      setReplyPinX(null);
      setReplyPinY(null);
      setReplyPinComment(null);
      setReplyingTo(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add reply');
    } finally {
      setSubmitting(false);
    }
  };

  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const handleDeleteComment = async (commentId: string) => {
    const confirmed = window.confirm('Delete this feedback? This action cannot be undone.');
    if (!confirmed) return;

    setDeletingCommentId(commentId);
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete');
      } else if (!response.ok) {
        throw new Error('Failed to delete comment');
      }
      // Remove the comment and its replies from state
      setComments(prev => prev.filter(c => c.id !== commentId && c.parent_comment_id !== commentId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete comment');
    } finally {
      setDeletingCommentId(null);
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

  // Get all replies for a top-level comment (flattened - no deep nesting)
  const getAllRepliesFlat = (commentId: string): Comment[] => {
    const directReplies = getReplies(commentId);
    const allReplies: Comment[] = [];
    
    const collectReplies = (replies: Comment[]) => {
      for (const reply of replies) {
        allReplies.push(reply);
        collectReplies(getReplies(reply.id));
      }
    };
    
    collectReplies(directReplies);
    // Sort by creation date
    return allReplies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  // Find the parent comment/reply to show "Replying to @user"
  const getParentComment = (parentId: string): Comment | undefined => {
    return comments.find(c => c.id === parentId);
  };

  const renderReply = (reply: Comment, topLevelCommentId: string) => {
    const isReplying = replyingTo === reply.id;
    const parentComment = getParentComment(reply.parent_comment_id ?? '');
    // Check if this is a reply to another reply (not to the top-level comment)
    const isReplyToReply = reply.parent_comment_id !== topLevelCommentId;
    
    return (
      <div key={reply.id} className="p-3 bg-white rounded-lg border border-black/10">
        {/* Show "Replying to @user" for nested replies */}
        {isReplyToReply && parentComment && (
          <div className="flex items-center gap-1.5 mb-2 text-xs text-black/50">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>Replying to</span>
            <span className="font-medium text-[#061E26]">@{parentComment.user_email?.split('@')[0] ?? 'user'}</span>
          </div>
        )}
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
            {(reply.attachment_url.startsWith('data:image/') || reply.attachment_url.startsWith('http://') || reply.attachment_url.startsWith('https://')) ? (
              <button
                type="button"
                onClick={() => setViewingImage(reply.attachment_url ?? null)}
                className="inline-block max-w-full cursor-zoom-in hover:opacity-90 transition-opacity"
                title="Click to view full size"
              >
                <img src={reply.attachment_url} alt="Captured frame" className="max-w-full max-h-48 rounded-lg border border-black/10" />
              </button>
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
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 pt-2 border-t border-black/10">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-5 h-5 flex-shrink-0 bg-gradient-to-br from-[#BA836B] to-[#061E26] rounded-full flex items-center justify-center text-white text-xs font-bold">
              {reply.user_email?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <span className="text-xs text-black/60 truncate">{reply.user_email ?? 'Unknown User'}</span>
            <span className="text-xs text-black/40 hidden sm:inline">-</span>
            <span className="text-xs text-black/50 hidden sm:inline" title={new Date(reply.created_at).toLocaleString()}>
              {new Date(reply.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setReplyingTo(isReplying ? null : reply.id);
                setReplyTimestamp('0:00');
                setReplyContent('');
                setReplyAttachment(null);
                setReplyAttachmentPreview(null);
                setReplyAttachmentDataUrl(null);
              }}
              className="text-xs font-medium text-[#061E26] hover:text-black hover:underline"
            >
              {isReplying ? 'Cancel' : 'Reply'}
            </button>
            {(isAdmin || reply.user_uid === user?.id) && (
              <button
                type="button"
                onClick={() => handleDeleteComment(reply.id)}
                disabled={deletingCommentId === reply.id}
                className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
                title="Delete this reply"
              >
                {deletingCommentId === reply.id ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>
        {isReplying && (
          <form onSubmit={(e) => handleAddReply(e, reply.id)} className="mt-3 p-2 sm:p-3 bg-gradient-to-br from-white to-[#061E26]/5 rounded-lg border border-black/10">
            {replyAttachmentPreview && (
              <div className="relative bg-black/5 rounded-lg border border-[#061E26]/20 overflow-hidden mb-3">
                <div className="flex items-center justify-between px-3 py-2 bg-[#061E26]/10 border-b border-[#061E26]/20">
                  <span className="text-xs font-semibold text-[#061E26]">Captured frame</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => openAnnotationEditor(true)} className="px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-1.5" title="Add pins, lines, arrows, text to this frame">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Annotate
                    </button>
                    <button type="button" onClick={() => removeAttachment(true)} className="p-1 text-[#061E26]/60 hover:text-[#061E26] rounded hover:bg-[#061E26]/10 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <div className="w-full max-h-32 flex items-center justify-center rounded overflow-hidden bg-black/5">
                    <img src={replyAttachmentPreview} alt="Captured frame" className="w-full max-h-32 object-contain" />
                  </div>
                </div>
              </div>
            )}
            <textarea
              dir="ltr"
              placeholder="Write a reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={2}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent resize-none"
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
            <div className="flex gap-2 mt-2">
              <button type="submit" disabled={submitting || (!replyContent.trim() && !replyAttachment && !replyAttachmentDataUrl)} className="px-3 py-2 sm:py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#061E26] to-black rounded-md hover:shadow-md disabled:opacity-50 transition-all">
                Reply
              </button>
              <button type="button" onClick={() => { setReplyingTo(null); setReplyContent(''); setReplyTimestamp('0:00'); setReplyAttachment(null); setReplyAttachmentPreview(null); setReplyAttachmentDataUrl(null); }} className="px-3 py-2 sm:py-1.5 text-xs font-medium text-black/60 hover:text-black hover:bg-black/5 rounded-md transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  if (loading) return <PageLoading />;
  if (error) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{error}</div>
      </div>
    );
  }
  if (!submission) return null;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-6">
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
                    <option value="approved">Move to Approved</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
              {/* Auto-archiving indicator */}
              {isAutoArchiving && !archiving && (
                <span className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Archiving to Google Drive...
                </span>
              )}
              {/* Retry Archive Button (admin only) */}
              {canArchive && (
                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 hover:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {archiving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Archiving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retry Archive
                    </>
                  )}
                </button>
              )}
              {/* Video Source Badge */}
              {submission.video_source && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  submission.video_source === 'firebase'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {submission.video_source === 'firebase' ? 'Temporary Storage' : 'Google Drive'}
                </span>
              )}
            </div>
            {archiveError && (
              <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {archiveError}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 flex justify-center">
              <div className="w-full max-w-[360px] aspect-[9/16]">
                <VideoPlayer
                embedUrl={submission.embed_url}
                title={submission.title}
                onTimestampCapture={handleTimestampCapture}
                onCaptureRequest={handleCaptureClick}
                onFrameCapture={handleFrameCapture}
                autoCaptureOnPause={false}
              />
              </div>
            </div>
          </div>
          {canPostFeedback && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-3 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-[#061E26]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h2 className="text-lg font-bold text-black">Add Feedback</h2>
                </div>
                <form onSubmit={handleAddComment} className="space-y-4">
                  {/* Captured Frame Preview */}
                  {commentAttachmentPreview && (
                    <div className="relative bg-black/5 rounded-lg border border-[#061E26]/20 overflow-hidden">
                      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#061E26]/10 border-b border-[#061E26]/20">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <svg className="w-4 h-4 flex-shrink-0 text-[#061E26]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs font-semibold text-[#061E26]">Captured Frame</span>
                          <span className="text-xs font-mono text-[#061E26]/70 bg-white/50 px-2 py-0.5 rounded">@ {commentTimestamp}</span>
                          {commentPinX != null && commentPinY != null && (
                            <span className="text-xs text-[#061E26]/70">Pin set</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => openAnnotationEditor(false)} className="px-2 sm:px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-1.5" title="Add pins, lines, arrows, text to this frame">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span className="hidden sm:inline">Annotate</span>
                          </button>
                          <button type="button" onClick={() => removeAttachment(false)} className="p-1 text-[#061E26]/60 hover:text-[#061E26] rounded hover:bg-[#061E26]/10 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="w-full max-h-48 flex items-center justify-center rounded overflow-hidden bg-black/5">
                          <img src={commentAttachmentPreview} alt="Captured frame" className="w-full max-h-48 object-contain" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Capture Frame Button - Single action */}
                  {!commentAttachmentPreview && (
                    <button
                      type="button"
                      onClick={handleCaptureFrameClick}
                      disabled={frameCapturing}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3.5 sm:py-3 text-sm font-semibold text-[#061E26] bg-[#061E26]/10 hover:bg-[#061E26]/20 rounded-lg transition-all border-2 border-dashed border-[#061E26]/30 hover:border-[#061E26]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {frameCapturing ? 'Capturing...' : 'Capture Frame'}
                    </button>
                  )}

                  {frameCaptureError && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{frameCaptureError}</p>
                  )}

                  {/* Timestamp input (hidden when frame is captured, shown for manual entry) */}
                  {!commentAttachmentPreview && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-black/50">Or enter timestamp manually:</span>
                      <input
                        type="text"
                        placeholder="0:00"
                        value={commentTimestamp}
                        onChange={(e) => setCommentTimestamp(e.target.value)}
                        className="w-20 px-2 py-1 text-xs font-mono border border-black/20 rounded focus:outline-none focus:ring-1 focus:ring-[#061E26]"
                      />
                    </div>
                  )}

                  <textarea
                    dir="ltr"
                    placeholder="Share your feedback or ask a question..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 text-sm border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent resize-none"
                    style={{ direction: 'ltr', textAlign: 'left' }}
                  />
                  <button
                    type="submit"
                    disabled={submitting || (!newComment.trim() && !commentAttachment && !commentAttachmentDataUrl)}
                    className="w-full px-4 py-3.5 sm:py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#061E26] to-black rounded-lg hover:shadow-lg hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shadow-md"
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
          )}
        </div>

        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden xl:sticky xl:top-6">
            <div className="p-3 sm:p-5">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-[#061E26]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h2 className="text-lg font-bold text-black">Feedback</h2>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-[#061E26]/10 text-[#061E26] rounded-full">{comments.length}</span>
              </div>
              <div className="space-y-3 sm:space-y-4 max-h-[600px] sm:max-h-[800px] xl:max-h-[1200px] overflow-y-auto pr-1 custom-scrollbar">
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
                    <div key={comment.id} className="bg-gradient-to-br from-white to-black/5 rounded-lg p-3 sm:p-4 border border-black/10 hover:border-[#061E26]/30 transition-colors">
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
                          {(comment.attachment_url.startsWith('data:image/') || comment.attachment_url.startsWith('http://') || comment.attachment_url.startsWith('https://')) ? (
                            <button
                              type="button"
                              onClick={() => setViewingImage(comment.attachment_url ?? null)}
                              className="inline-block max-w-full cursor-zoom-in hover:opacity-90 transition-opacity"
                              title="Click to view full size"
                            >
                              <img src={comment.attachment_url} alt="Captured frame" className="max-w-full max-h-48 rounded-lg border border-black/10" />
                            </button>
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
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 pt-3 border-t border-black/10">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-6 h-6 flex-shrink-0 bg-gradient-to-br from-[#061E26] to-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {comment.user_email?.charAt(0).toUpperCase() ?? 'U'}
                          </div>
                          <span className="text-xs font-medium text-black/70 truncate">{comment.user_email ?? 'Unknown User'}</span>
                          <span className="text-xs text-black/40 hidden sm:inline">-</span>
                          <span className="text-xs text-black/50 hidden sm:inline" title={new Date(comment.created_at).toLocaleString()}>
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            className="text-xs font-medium text-[#061E26] hover:text-black hover:underline"
                          >
                            {replyingTo === comment.id ? 'Cancel' : 'Reply'}
                          </button>
                          {(isAdmin || comment.user_uid === user?.id) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              disabled={deletingCommentId === comment.id}
                              className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
                              title="Delete this feedback"
                            >
                              {deletingCommentId === comment.id ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>
                      {replyingTo === comment.id && (
                        <form onSubmit={(e) => handleAddReply(e, comment.id)} className="mt-3 p-2 sm:p-3 bg-gradient-to-br from-white to-[#061E26]/5 rounded-lg border border-black/10">
                          {canReview && (
                            <div className="flex items-center gap-2 mb-2">
                              <input type="text" placeholder="0:00" value={replyTimestamp} onChange={(e) => setReplyTimestamp(e.target.value)} className="w-20 px-2 py-1.5 text-xs font-mono border border-black/20 rounded-md focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent" />
                              <span className="text-xs text-black/50">Timestamp (optional)</span>
                            </div>
                          )}
                          <textarea dir="ltr" placeholder="Write a reply..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows={2} autoFocus className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent resize-none" style={{ direction: 'ltr', textAlign: 'left' }} />
                          <div className="flex gap-2 mt-2">
                            <button type="submit" disabled={submitting || !replyContent.trim()} className="px-3 py-2 sm:py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#061E26] to-black rounded-md hover:shadow-md disabled:opacity-50 transition-all">Reply</button>
                            <button type="button" onClick={() => { setReplyingTo(null); setReplyContent(''); setReplyTimestamp('0:00'); }} className="px-3 py-2 sm:py-1.5 text-xs font-medium text-black/60 hover:text-black hover:bg-black/5 rounded-md transition-colors">Cancel</button>
                          </div>
                        </form>
                      )}
                      {getAllRepliesFlat(comment.id).length > 0 && (
                        <div className="mt-3 space-y-2 ml-3 sm:ml-6 border-l-2 border-[#061E26]/20 pl-3 sm:pl-4">
                          {getAllRepliesFlat(comment.id).map((reply) => (
                            <React.Fragment key={reply.id}>{renderReply(reply, comment.id)}</React.Fragment>
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

      {/* Screenshot Capture Modal - for Google Drive embeds */}
      {showScreenshotModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowScreenshotModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[#061E26]/10 rounded-lg">
                <svg className="w-6 h-6 text-[#061E26]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-black">Capture Frame Screenshot</h3>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <p className="text-sm font-medium text-blue-900">Pause the video at the frame you want</p>
                  <p className="text-xs text-blue-700 mt-0.5">Make sure you can see the exact moment you want to reference</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <p className="text-sm font-medium text-blue-900">Take a screenshot</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono bg-white border border-blue-200 rounded">
                      <span className="text-blue-700">Windows:</span>&nbsp;<strong>Win + Shift + S</strong>
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono bg-white border border-blue-200 rounded">
                      <span className="text-blue-700">Mac:</span>&nbsp;<strong>Cmd + Shift + 4</strong>
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <p className="text-sm font-medium text-blue-900">Click the button below to paste</p>
                  <p className="text-xs text-blue-700 mt-0.5">Your screenshot will be automatically attached with the timestamp</p>
                </div>
              </div>
            </div>

            {/* Timestamp input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-2">Video Timestamp</label>
              <input
                type="text"
                value={commentTimestamp}
                onChange={(e) => setCommentTimestamp(e.target.value)}
                placeholder="0:00 or 1:23:45"
                className="w-full px-4 py-2.5 text-sm font-mono border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent"
              />
              <p className="text-xs text-black/50 mt-1">Enter the video timestamp when you paused (e.g. 1:30 for 1 minute 30 seconds)</p>
            </div>

            {frameCaptureError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs text-red-600">{frameCaptureError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#061E26] to-black rounded-lg hover:shadow-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Paste Screenshot
              </button>
              <button
                type="button"
                onClick={() => { setShowScreenshotModal(false); setFrameCaptureError(null); }}
                className="px-4 py-3 text-sm font-medium text-black/60 hover:text-black hover:bg-black/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAnnotationModal && annotationImageDataUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleAnnotationCancel}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-2 border-b border-black/10 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#061E26]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <h3 className="text-lg font-bold text-black">Annotate Frame</h3>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-4">
              <FrameAnnotationEditor
                imageDataUrl={annotationImageDataUrl}
                onSave={handleAnnotationSave}
                onCancel={handleAnnotationCancel}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <button
              type="button"
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={viewingImage}
              alt="Full size view"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
