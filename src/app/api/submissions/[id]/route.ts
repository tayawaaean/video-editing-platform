import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserBySupabaseUid, getSubmissionById, updateSubmissionStatus } from '@/lib/airtable';
import { updateSubmissionStatusSchema } from '@/lib/validations';

// GET /api/submissions/[id] - Get a single submission
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const airtableUser = await getUserBySupabaseUid(user.id);
    if (!airtableUser) {
      return NextResponse.json({ error: 'User not provisioned' }, { status: 403 });
    }

    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Submitters can only view their own submissions
    if (airtableUser.role === 'submitter' && submission.submitter_uid !== user.id) {
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const airtableUser = await getUserBySupabaseUid(user.id);
    if (!airtableUser) {
      return NextResponse.json({ error: 'User not provisioned' }, { status: 403 });
    }

    // Only reviewers and admins can update status
    if (airtableUser.role === 'submitter') {
      return NextResponse.json({ error: 'Only reviewers can update status' }, { status: 403 });
    }

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

    // Update submission status
    const updatedSubmission = await updateSubmissionStatus(id, status);

    return NextResponse.json({ data: updatedSubmission });
  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
