import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSubmissionById, updateSubmissionStatus } from '@/lib/airtable';
import { updateSubmissionStatusSchema } from '@/lib/validations';
import { archiveVideoToGoogleDrive } from '@/lib/archive-video';

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

// PATCH /api/submissions/[id] - Update submission status
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

    const { role } = session.user;

    // Only reviewers and admins can update status
    if (role === 'submitter') {
      return NextResponse.json({ error: 'Only reviewers can update status' }, { status: 403 });
    }

    // Fetch submission from Airtable
    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = updateSubmissionStatusSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { status } = validationResult.data;

    // Update in Airtable
    const updatedSubmission = await updateSubmissionStatus(id, status);

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
  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
