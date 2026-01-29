import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSubmissionById } from '@/lib/airtable';
import { isGoogleDriveConfigured } from '@/lib/google-drive-upload';
import { archiveVideoToGoogleDrive } from '@/lib/archive-video';

export const maxDuration = 120;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/submissions/[id]/archive
 * Manually archive (or retry archive) a submission's video from Firebase to Google Drive.
 * Only available for admin users on approved submissions with Firebase video source.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can archive
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can archive submissions' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check Google Drive configuration
    if (!isGoogleDriveConfigured()) {
      return NextResponse.json(
        { error: 'Google Drive is not configured. Please add Google Drive credentials.' },
        { status: 500 }
      );
    }

    // Get the submission to validate state before archiving
    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (submission.video_source !== 'firebase') {
      return NextResponse.json(
        { error: 'This submission is not using Firebase storage' },
        { status: 400 }
      );
    }

    if (submission.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved submissions can be archived' },
        { status: 400 }
      );
    }

    if (!submission.firebase_video_path) {
      return NextResponse.json(
        { error: 'Firebase video path is missing' },
        { status: 400 }
      );
    }

    const result = await archiveVideoToGoogleDrive(id, '[manual-archive]');

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to archive submission' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: submission,
      archived: {
        googleDriveFileId: result.googleDriveFileId,
        googleDriveUrl: result.googleDriveUrl,
        embedUrl: result.embedUrl,
        firebaseDeleted: result.firebaseDeleted,
      },
    });
  } catch (error) {
    console.error('Error archiving submission:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to archive submission' },
      { status: 500 }
    );
  }
}
