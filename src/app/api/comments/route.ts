import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserBySupabaseUid, getCommentsBySubmission, createComment, getSubmissionById, getUserEmailMap } from '@/lib/airtable';
import { createCommentSchema } from '@/lib/validations';

// GET /api/comments?submission_id=xxx - Get comments for a submission
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

    // Submitters can only view comments on their own submissions
    if (airtableUser.role === 'submitter' && submission.submitter_uid !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const comments = await getCommentsBySubmission(submissionId);

    // Fetch user emails for all commenters
    const userUids = comments.map(c => c.user_uid);
    const emailMap = await getUserEmailMap(userUids);

    // Add user emails to comments
    const commentsWithEmails = comments.map(comment => ({
      ...comment,
      user_email: emailMap[comment.user_uid] || 'Unknown',
    }));

    return NextResponse.json({ data: commentsWithEmails });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/comments - Create a new comment
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

    const body = await request.json();
    
    // Validate input
    const validationResult = createCommentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { submission_id, timestamp_seconds, content, parent_comment_id } = validationResult.data;

    // Verify access to the submission
    const submission = await getSubmissionById(submission_id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Submitters can only comment on their own submissions
    if (airtableUser.role === 'submitter' && submission.submitter_uid !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Create comment
    const comment = await createComment({
      submission_id,
      user_uid: user.id,
      timestamp_seconds,
      content,
      parent_comment_id,
    });

    return NextResponse.json({ 
      data: {
        ...comment,
        user_email: airtableUser.email,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
