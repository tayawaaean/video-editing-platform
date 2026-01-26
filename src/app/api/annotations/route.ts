import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helper';
import { getAnnotationsBySubmission, createAnnotation, getSubmissionById, getUserEmailMap } from '@/lib/airtable';
import { createAnnotationSchema } from '@/lib/validations';
import { DEV_MODE, DEV_ANNOTATIONS, DEV_SUBMISSIONS, DEV_USERS } from '@/lib/dev-mode';
import type { Annotation } from '@/types';

// In-memory store for dev mode
let devAnnotations = [...DEV_ANNOTATIONS];

function getDevAnnotationsBySubmission(submissionId: string): Annotation[] {
  return devAnnotations.filter(a => a.submission_id === submissionId);
}

function getDevSubmission(id: string) {
  return DEV_SUBMISSIONS.find(s => s.id === id) || null;
}

function getDevUserEmail(uid: string): string {
  const user = DEV_USERS.find(u => u.supabase_uid === uid);
  return user?.email || 'Unknown';
}

// GET /api/annotations?submission_id=xxx - Get annotations for a submission
export async function GET(request: NextRequest) {
  try {
    const { user, supabaseUid } = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const submissionId = searchParams.get('submission_id');

    if (!submissionId) {
      return NextResponse.json({ error: 'submission_id is required' }, { status: 400 });
    }

    // Verify access to the submission
    const submission = DEV_MODE ? getDevSubmission(submissionId) : await getSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Submitters can only view annotations on their own submissions
    if (user.role === 'submitter' && submission.submitter_uid !== supabaseUid) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (DEV_MODE) {
      const annotations = getDevAnnotationsBySubmission(submissionId);
      const annotationsWithEmails = annotations.map(annotation => ({
        ...annotation,
        reviewer_email: getDevUserEmail(annotation.reviewer_uid),
      }));
      return NextResponse.json({ data: annotationsWithEmails });
    }

    const annotations = await getAnnotationsBySubmission(submissionId);

    // Fetch user emails for all reviewers
    const userUids = annotations.map(a => a.reviewer_uid);
    const emailMap = await getUserEmailMap(userUids);

    // Add user emails to annotations
    const annotationsWithEmails = annotations.map(annotation => ({
      ...annotation,
      reviewer_email: emailMap[annotation.reviewer_uid] || 'Unknown',
    }));

    return NextResponse.json({ data: annotationsWithEmails });
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/annotations - Create a new annotation (reviewer/admin only)
export async function POST(request: NextRequest) {
  try {
    const { user, supabaseUid } = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only reviewers and admins can create annotations
    if (user.role === 'submitter') {
      return NextResponse.json({ error: 'Only reviewers can create annotations' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = createAnnotationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { submission_id, timestamp_seconds, note } = validationResult.data;

    // Verify submission exists
    const submission = DEV_MODE ? getDevSubmission(submission_id) : await getSubmissionById(submission_id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (DEV_MODE) {
      const newAnnotation: Annotation = {
        id: `annotation-${Date.now()}`,
        submission_id,
        reviewer_uid: supabaseUid!,
        timestamp_seconds,
        note,
        created_at: new Date().toISOString(),
      };
      devAnnotations.push(newAnnotation);
      return NextResponse.json({ 
        data: {
          ...newAnnotation,
          reviewer_email: user.email,
        }
      }, { status: 201 });
    }

    // Create annotation
    const annotation = await createAnnotation({
      submission_id,
      reviewer_uid: supabaseUid!,
      timestamp_seconds,
      note,
    });

    return NextResponse.json({ 
      data: {
        ...annotation,
        reviewer_email: user.email,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating annotation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
