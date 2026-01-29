// Type definitions for the Video Review Platform

export type UserRole = 'submitter' | 'reviewer' | 'admin';
export type SubmissionStatus = 'pending' | 'reviewing' | 'approved';
export type VideoSource = 'firebase' | 'google_drive';

// Airtable record wrapper
export interface AirtableRecord<T> {
  id: string;
  fields: T;
  createdTime: string;
}

// User types
export interface UserFields {
  supabase_uid: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface User {
  id: string;
  /** Supabase user id (UUID). Optional when user is sourced from Supabase users table only. */
  supabase_uid?: string;
  email: string;
  role: UserRole;
  created_at: string;
}

// Submission types
export interface SubmissionFields {
  title: string;
  description?: string;
  /** Google Drive URL (set after archiving or if submitted via Drive link) */
  google_drive_url?: string;
  /** Embed URL for video playback */
  embed_url: string;
  submitter_uid: string;
  status: SubmissionStatus;
  /** Where the video is currently stored */
  video_source: VideoSource;
  /** Firebase Storage file path (for deletion after archiving) */
  firebase_video_path?: string;
  /** Firebase Storage download URL */
  firebase_video_url?: string;
  /** Firebase video file size in bytes (for storage quota) */
  firebase_video_size?: number;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  title: string;
  description?: string;
  /** Google Drive URL (set after archiving or if submitted via Drive link) */
  google_drive_url?: string;
  /** Embed URL for video playback */
  embed_url: string;
  submitter_uid: string;
  status: SubmissionStatus;
  /** Where the video is currently stored */
  video_source: VideoSource;
  /** Firebase Storage file path (for deletion after archiving) */
  firebase_video_path?: string;
  /** Firebase Storage download URL */
  firebase_video_url?: string;
  /** Firebase video file size in bytes (for storage quota) */
  firebase_video_size?: number;
  created_at: string;
  updated_at: string;
}

// Comment (Feedback) types - stored in Airtable Feedback table
export interface CommentFields {
  submission_id: string;
  user_uid: string;
  timestamp_seconds: number;
  content: string;
  parent_comment_id?: string;
  attachment_url?: string;
  /** Pin position on attachment image, normalized 0-1 (Loom-style point) */
  attachment_pin_x?: number;
  attachment_pin_y?: number;
  /** Comment text associated with the pin */
  attachment_pin_comment?: string;
  created_at: string;
}

export interface Comment {
  id: string;
  submission_id: string;
  user_uid: string;
  user_email?: string;
  timestamp_seconds: number;
  content: string;
  parent_comment_id?: string;
  attachment_url?: string;
  /** Pin position on attachment image, normalized 0-1 */
  attachment_pin_x?: number;
  attachment_pin_y?: number;
  /** Comment text associated with the pin */
  attachment_pin_comment?: string;
  created_at: string;
  replies?: Comment[];
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Auth context type
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
