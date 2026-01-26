import { z } from 'zod';

// User schemas
export const userRoleSchema = z.enum(['submitter', 'reviewer', 'admin']);

export const createUserSchema = z.object({
  supabase_uid: z.string().min(1, 'Supabase UID is required'),
  email: z.string().email('Invalid email address'),
  role: userRoleSchema,
});

export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
});

// Submission schemas
export const submissionStatusSchema = z.enum(['pending', 'reviewing', 'completed']);

export const createSubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z.string().max(5000, 'Description must be 5000 characters or less').optional(),
  google_drive_url: z.string().url('Invalid URL').refine(
    (url) => url.includes('drive.google.com'),
    'Must be a Google Drive URL'
  ),
});

export const updateSubmissionStatusSchema = z.object({
  status: submissionStatusSchema,
});

// Comment schemas
export const createCommentSchema = z.object({
  submission_id: z.string().min(1, 'Submission ID is required'),
  timestamp_seconds: z.number().min(0, 'Timestamp must be non-negative'),
  content: z.string().min(1, 'Comment content is required').max(2000, 'Comment must be 2000 characters or less'),
  parent_comment_id: z.string().optional(),
});

// Annotation schemas
export const createAnnotationSchema = z.object({
  submission_id: z.string().min(1, 'Submission ID is required'),
  timestamp_seconds: z.number().min(0, 'Timestamp must be non-negative'),
  note: z.string().min(1, 'Annotation note is required').max(2000, 'Note must be 2000 characters or less'),
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type UpdateSubmissionStatusInput = z.infer<typeof updateSubmissionStatusSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
