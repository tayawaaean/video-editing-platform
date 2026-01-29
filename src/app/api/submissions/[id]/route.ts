import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getSubmissionById,
  updateSubmissionStatus,
  updateSubmissionMetadata,
  deleteSubmission,
  deleteCommentsBySubmission,
  deleteVersionsBySubmission,
  createComment,
} from '@/lib/airtable';
import { updateSubmissionStatusSchema, updateSubmissionMetadataSchema } from '@/lib/validations';
import { archiveVideoToGoogleDrive } from '@/lib/archive-video';
import { deleteFileFromFirebaseAdmin } from '@/lib/firebase-admin';

export const maxDuration = 120;

// GET /api/submissions/[id] - Get a single submission
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, role } = session.user;

    // Fetch submission from Airtable
    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Submitters can only view their own submissions
    if (role === 'submitter' && submission.submitter_uid !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ data: submission });
  } catch (error) {
    console.error('Error fetching submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/submissions/[id] - Update submission status or metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, role } = session.user;

    // Fetch submission from Airtable
    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const body = await request.json();

    // Branch: if body has `status`, this is a status update
    if ('status' in body) {
      // Only reviewers and admins can update status
      if (role === 'submitter') {
        return NextResponse.json({ error: 'Only reviewers can update status' }, { status: 403 });
      }

      const validationResult = updateSubmissionStatusSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: validationResult.error.issues[0].message },
          { status: 400 }
        );
      }

      const { status, revision_summary } = validationResult.data;

      // Build extra fields for revision_requested
      const extraFields: Record<string, unknown> = {};
      if (status === 'revision_requested') {
        extraFields.revision_requested_at = new Date().toISOString();
      }

      const updatedSubmission = await updateSubmissionStatus(id, status, extraFields);

      // Auto-create summary comment when requesting revision
      if (status === 'revision_requested' && revision_summary?.trim()) {
        try {
          await createComment({
            submission_id: id,
            user_uid: userId,
            timestamp_seconds: 0,
            content: `[Revision Requested] ${revision_summary.trim()}`,
            revision_round: submission.revision_round ?? 1,
          });
        } catch (err) {
          console.error('Failed to create revision summary comment:', err);
        }
      }

      // Auto-archive to Google Drive when approved and video is on Firebase
      if (
        status === 'approved' &&
        submission.video_source === 'firebase' &&
        submission.firebase_video_path
      ) {
        after(async () => {
          try {
            console.log(`[auto-archive] Starting archive for submission ${id}`);
            const result = await archiveVideoToGoogleDrive(id, '[auto-archive]');
            if (!result.success) {
              console.error(`[auto-archive] Failed for submission ${id}: ${result.error}`);
            }
          } catch (err) {
            console.error(`[auto-archive] Error for submission ${id}:`, err);
          }
        });
      }

      return NextResponse.json({ data: updatedSubmission });
    }

    // Branch: metadata edit (title/description)
    if ('title' in body || 'description' in body) {
      const isOwner = submission.submitter_uid === userId;
      const isAdmin = role === 'admin';

      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Only the owner or admin can edit metadata' }, { status: 403 });
      }

      const editableStatuses = ['pending', 'reviewing', 'revision_requested'];
      if (!editableStatuses.includes(submission.status)) {
        return NextResponse.json(
          { error: 'Cannot edit metadata in current status' },
          { status: 400 }
        );
      }

      const validationResult = updateSubmissionMetadataSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: validationResult.error.issues[0].message },
          { status: 400 }
        );
      }

      const updatedSubmission = await updateSubmissionMetadata(id, validationResult.data);
      return NextResponse.json({ data: updatedSubmission });
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/submissions/[id] - Delete a submission and all related records
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, role } = session.user;

    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const isOwner = submission.submitter_uid === userId;
    const isAdmin = role === 'admin';

    // Owner can delete when pending/reviewing/revision_requested; admin can delete any
    if (isAdmin) {
      // Admin can delete any submission
    } else if (isOwner) {
      const deletableStatuses = ['pending', 'reviewing', 'revision_requested'];
      if (!deletableStatuses.includes(submission.status)) {
        return NextResponse.json(
          { error: 'Can only delete submissions that are pending, reviewing, or revision requested' },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete Firebase video if present
    if (submission.video_source === 'firebase' && submission.firebase_video_path) {
      try {
        await deleteFileFromFirebaseAdmin(submission.firebase_video_path);
      } catch (err) {
        console.error('Failed to delete Firebase video:', err);
        // Continue with deletion even if Firebase delete fails
      }
    }

    // Cascade delete: comments, versions, then submission
    await Promise.all([
      deleteCommentsBySubmission(id),
      deleteVersionsBySubmission(id),
    ]);

    await deleteSubmission(id);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
