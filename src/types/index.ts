// Type definitions for the Video Review Platform

export type UserRole = 'submitter' | 'reviewer' | 'admin';
export type SubmissionStatus = 'pending' | 'reviewing' | 'completed';

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
  google_drive_url: string;
  embed_url: string;
  submitter_uid: string;
  status: SubmissionStatus;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  title: string;
  description?: string;
  google_drive_url: string;
  embed_url: string;
  submitter_uid: string;
  status: SubmissionStatus;
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
