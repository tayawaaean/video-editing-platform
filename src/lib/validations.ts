import { z } from 'zod';

// User schemas
export const userRoleSchema = z.enum(['submitter', 'reviewer', 'admin']);

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: userRoleSchema,
});

export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Submission schemas
export const submissionStatusSchema = z.enum(['pending', 'reviewing', 'approved', 'revision_requested']);
export const videoSourceSchema = z.enum(['firebase', 'google_drive']);

// Schema for direct (Firebase) upload submission only
export const createSubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z.string().max(5000, 'Description must be 5000 characters or less').optional(),
  video_source: z.literal('firebase'),
  firebase_video_url: z.string().url('Invalid Firebase video URL'),
  firebase_video_path: z.string().min(1, 'Firebase video path is required'),
  firebase_video_size: z.number().int().min(0, 'File size must be non-negative'),
});

export const updateSubmissionStatusSchema = z.object({
  status: submissionStatusSchema,
  revision_summary: z.string().max(2000).optional(),
});

export const updateSubmissionMetadataSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less').optional(),
  description: z.string().max(5000, 'Description must be 5000 characters or less').optional(),
});

// Resubmit: direct (Firebase) upload only
export const resubmitSchema = z.object({
  video_source: z.literal('firebase'),
  firebase_video_url: z.string().url('Invalid Firebase video URL'),
  firebase_video_path: z.string().min(1, 'Firebase video path is required'),
  firebase_video_size: z.number().int().min(0, 'File size must be non-negative'),
  embed_url: z.string().url('Invalid embed URL'),
});

// Comment (feedback) schemas
export const createCommentSchema = z.object({
  submission_id: z.string().min(1, 'Submission ID is required'),
  timestamp_seconds: z.number().min(0, 'Timestamp must be non-negative'),
  content: z.string().max(2000, 'Comment must be 2000 characters or less').optional(),
  parent_comment_id: z.string().optional(),
  attachment_url: z.string().url('Invalid attachment URL').optional().or(z.string().startsWith('data:').optional()),
  /** Pin on attachment image, normalized 0-1 */
  attachment_pin_x: z.number().min(0).max(1).optional(),
  attachment_pin_y: z.number().min(0).max(1).optional(),
  /** Comment text for the pin */
  attachment_pin_comment: z.string().max(500).optional(),
}).refine((data) => (data.content && data.content.trim().length > 0) || data.attachment_url, {
  message: 'Either content or attachment is required',
  path: ['content'],
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type UpdateSubmissionStatusInput = z.infer<typeof updateSubmissionStatusSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateSubmissionMetadataInput = z.infer<typeof updateSubmissionMetadataSchema>;
export type ResubmitInput = z.infer<typeof resubmitSchema>;