import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helper';
import { getCommentsBySubmission, createComment, getSubmissionById, getUserEmailMap } from '@/lib/airtable';
import { createCommentSchema } from '@/lib/validations';
import { DEV_MODE, DEV_COMMENTS, DEV_SUBMISSIONS, DEV_USERS } from '@/lib/dev-mode';
import type { Comment } from '@/types';

// In-memory store for dev mode
let devComments = [...DEV_COMMENTS];

function getDevCommentsBySubmission(submissionId: string): Comment[] {
  return devComments.filter(c => c.submission_id === submissionId);
}

function getDevSubmission(id: string) {
  return DEV_SUBMISSIONS.find(s => s.id === id) || null;
}

function getDevUserEmail(uid: string): string {
  const user = DEV_USERS.find(u => u.supabase_uid === uid);
  return user?.email || 'Unknown';
}

// GET /api/comments?submission_id=xxx - Get comments for a submission
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

    // Submitters can only view comments on their own submissions
    if (user.role === 'submitter' && submission.submitter_uid !== supabaseUid) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (DEV_MODE) {
      const comments = getDevCommentsBySubmission(submissionId);
      const commentsWithEmails = comments.map(comment => ({
        ...comment,
        user_email: getDevUserEmail(comment.user_uid),
      }));
      return NextResponse.json({ data: commentsWithEmails });
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
    const { user, supabaseUid } = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const submission = DEV_MODE ? getDevSubmission(submission_id) : await getSubmissionById(submission_id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Submitters can only comment on their own submissions
    if (user.role === 'submitter' && submission.submitter_uid !== supabaseUid) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (DEV_MODE) {
      const newComment: Comment = {
        id: `comment-${Date.now()}`,
        submission_id,
        user_uid: supabaseUid!,
        timestamp_seconds,
        content,
        parent_comment_id: parent_comment_id || undefined,
        created_at: new Date().toISOString(),
      };
      devComments.push(newComment);
      return NextResponse.json({ 
        data: {
          ...newComment,
          user_email: user.email,
        }
      }, { status: 201 });
    }

    // Create comment
    const comment = await createComment({
      submission_id,
      user_uid: supabaseUid!,
      timestamp_seconds,
      content,
      parent_comment_id,
    });

    return NextResponse.json({ 
      data: {
        ...comment,
        user_email: user.email,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
