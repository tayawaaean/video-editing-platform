import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getSubmissionById,
  updateSubmissionForResubmit,
  createVersion,
  getFirebaseStorageUsed,
} from '@/lib/airtable';
import { resubmitSchema } from '@/lib/validations';

const FIREBASE_QUOTA_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB default

// POST /api/submissions/[id]/resubmit - Resubmit with new video
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = session.user;

    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Only the owner can resubmit
    if (submission.submitter_uid !== userId) {
      return NextResponse.json({ error: 'Only the submission owner can resubmit' }, { status: 403 });
    }

    // Only when revision_requested
    if (submission.status !== 'revision_requested') {
      return NextResponse.json(
        { error: 'Can only resubmit when revision has been requested' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validationResult = resubmitSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    const currentUsage = await getFirebaseStorageUsed();
    if (currentUsage + data.firebase_video_size > FIREBASE_QUOTA_BYTES) {
      return NextResponse.json(
        { error: 'Firebase storage quota exceeded.' },
        { status: 400 }
      );
    }

    const currentRound = submission.revision_round ?? 1;
    await createVersion({
      submission_id: id,
      version_number: currentRound,
      video_source: submission.video_source,
      embed_url: submission.embed_url,
      google_drive_url: submission.google_drive_url,
      firebase_video_url: submission.firebase_video_url,
      firebase_video_path: submission.firebase_video_path,
      firebase_video_size: submission.firebase_video_size,
    });

    const newRound = currentRound + 1;
    const updateFields: Record<string, unknown> = {
      embed_url: data.embed_url,
      video_source: 'firebase',
      revision_round: newRound,
      revision_requested_at: '',
      firebase_video_url: data.firebase_video_url,
      firebase_video_path: data.firebase_video_path,
      firebase_video_size: data.firebase_video_size,
    };

    const updatedSubmission = await updateSubmissionForResubmit(id, updateFields);

    return NextResponse.json({ data: updatedSubmission });
  } catch (error) {
    console.error('Error resubmitting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
