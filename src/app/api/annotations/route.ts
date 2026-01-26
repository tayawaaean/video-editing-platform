import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserBySupabaseUid, getAnnotationsBySubmission, createAnnotation, getSubmissionById, getUserEmailMap } from '@/lib/airtable';
import { createAnnotationSchema } from '@/lib/validations';

// GET /api/annotations?submission_id=xxx - Get annotations for a submission
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const airtableUser = await getUserBySupabaseUid(user.id);
    if (!airtableUser) {
      return NextResponse.json({ error: 'User not provisioned' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const submissionId = searchParams.get('submission_id');

    if (!submissionId) {
      return NextResponse.json({ error: 'submission_id is required' }, { status: 400 });
    }

    // Verify access to the submission
    const submission = await getSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Submitters can only view annotations on their own submissions
    if (airtableUser.role === 'submitter' && submission.submitter_uid !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const airtableUser = await getUserBySupabaseUid(user.id);
    if (!airtableUser) {
      return NextResponse.json({ error: 'User not provisioned' }, { status: 403 });
    }

    // Only reviewers and admins can create annotations
    if (airtableUser.role === 'submitter') {
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
    const submission = await getSubmissionById(submission_id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Create annotation
    const annotation = await createAnnotation({
      submission_id,
      reviewer_uid: user.id,
      timestamp_seconds,
      note,
    });

    return NextResponse.json({ 
      data: {
        ...annotation,
        reviewer_email: airtableUser.email,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating annotation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
