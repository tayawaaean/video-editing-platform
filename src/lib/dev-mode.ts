// Development mode utilities
// When NEXT_PUBLIC_DEV_MODE=true or NEXT_ENV=development, bypass real auth and use mock users

import type { User, Submission, Comment, Annotation } from '@/types';

// Check for explicit dev mode flag first, then fall back to environment checks
export const DEV_MODE = 
  process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
  process.env.NEXT_ENV === 'development' ||
  process.env.NODE_ENV === 'development';
export const DEV_PASSWORD = '123password';

// Mock users for development
export const DEV_USERS: User[] = [
  {
    id: 'dev-admin-001',
    supabase_uid: 'dev-admin-uid',
    email: 'admin@example.com',
    role: 'admin',
    created_at: '2024-01-01',
  },
  {
    id: 'dev-reviewer-001',
    supabase_uid: 'dev-reviewer-uid',
    email: 'reviewer@example.com',
    role: 'reviewer',
    created_at: '2024-01-01',
  },
  {
    id: 'dev-submitter-001',
    supabase_uid: 'dev-submitter-uid',
    email: 'submitter@example.com',
    role: 'submitter',
    created_at: '2024-01-01',
  },
];

// Mock submissions for development
export const DEV_SUBMISSIONS: Submission[] = [
  {
    id: 'dev-sub-001',
    title: 'Product Demo Video v1',
    description: 'First draft of the product demo for Q1 launch',
    google_drive_url: 'https://drive.google.com/file/d/example1/view',
    embed_url: 'https://drive.google.com/file/d/example1/preview',
    submitter_uid: 'dev-submitter-uid',
    status: 'pending',
    created_at: '2024-01-15',
    updated_at: '2024-01-15',
  },
  {
    id: 'dev-sub-002',
    title: 'Training Video - Onboarding',
    description: 'New employee onboarding walkthrough',
    google_drive_url: 'https://drive.google.com/file/d/example2/view',
    embed_url: 'https://drive.google.com/file/d/example2/preview',
    submitter_uid: 'dev-submitter-uid',
    status: 'reviewing',
    created_at: '2024-01-10',
    updated_at: '2024-01-12',
  },
  {
    id: 'dev-sub-003',
    title: 'Marketing Campaign - Summer',
    description: 'Summer campaign promotional video',
    google_drive_url: 'https://drive.google.com/file/d/example3/view',
    embed_url: 'https://drive.google.com/file/d/example3/preview',
    submitter_uid: 'dev-submitter-uid',
    status: 'completed',
    created_at: '2024-01-05',
    updated_at: '2024-01-08',
  },
];

// Mock comments
export const DEV_COMMENTS: Comment[] = [
  {
    id: 'dev-comment-001',
    submission_id: 'dev-sub-001',
    user_uid: 'dev-reviewer-uid',
    user_email: 'reviewer@example.com',
    timestamp_seconds: 30,
    content: 'The intro could be shorter - consider cutting to 15 seconds',
    created_at: '2024-01-16',
  },
  {
    id: 'dev-comment-002',
    submission_id: 'dev-sub-001',
    user_uid: 'dev-submitter-uid',
    user_email: 'submitter@example.com',
    timestamp_seconds: 30,
    content: 'Good point, I\'ll trim it down',
    parent_comment_id: 'dev-comment-001',
    created_at: '2024-01-16',
  },
  {
    id: 'dev-comment-003',
    submission_id: 'dev-sub-002',
    user_uid: 'dev-admin-uid',
    user_email: 'admin@example.com',
    timestamp_seconds: 120,
    content: 'Great explanation of the dashboard features!',
    created_at: '2024-01-13',
  },
];

// Mock annotations
export const DEV_ANNOTATIONS: Annotation[] = [
  {
    id: 'dev-annotation-001',
    submission_id: 'dev-sub-001',
    reviewer_uid: 'dev-reviewer-uid',
    reviewer_email: 'reviewer@example.com',
    timestamp_seconds: 45,
    note: 'Audio levels drop here - needs normalization',
    created_at: '2024-01-16',
  },
  {
    id: 'dev-annotation-002',
    submission_id: 'dev-sub-002',
    reviewer_uid: 'dev-admin-uid',
    reviewer_email: 'admin@example.com',
    timestamp_seconds: 90,
    note: 'Consider adding captions for accessibility',
    created_at: '2024-01-13',
  },
];

// Get dev user by email
export function getDevUserByEmail(email: string): User | null {
  return DEV_USERS.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

// Get dev user by UID
export function getDevUserByUid(uid: string): User | null {
  return DEV_USERS.find(u => u.supabase_uid === uid) || null;
}

// Validate dev login
export function validateDevLogin(email: string, password: string): User | null {
  if (password !== DEV_PASSWORD) return null;
  return getDevUserByEmail(email);
}
