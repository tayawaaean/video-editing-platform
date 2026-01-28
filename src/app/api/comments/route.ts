import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getCommentsBySubmission, createComment, getSubmissionById, getUserEmailMap } from '@/lib/airtable';
import { createCommentSchema } from '@/lib/validations';

// GET /api/comments?submission_id=xxx - Get feedback (comments) for a submission
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { getUserBySupabaseUid } = await import('@/lib/airtable');
    const userData = await getUserBySupabaseUid(supabaseUser.id);
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 403 });
    }

    const submissionId = request.nextUrl.searchParams.get('submission_id');
    if (!submissionId) {
      return NextResponse.json({ error: 'submission_id is required' }, { status: 400 });
    }

    const submission = await getSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (userData.role === 'submitter' && submission.submitter_uid !== supabaseUser.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const comments = await getCommentsBySubmission(submissionId);
    const userUids = comments.map(c => c.user_uid);
    const emailMap = await getUserEmailMap(userUids);
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

// POST /api/comments - Create a new feedback comment
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { getUserBySupabaseUid } = await import('@/lib/airtable');
    const userData = await getUserBySupabaseUid(supabaseUser.id);
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = createCommentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { submission_id, timestamp_seconds, content, parent_comment_id, attachment_url } = validationResult.data;

    const submission = await getSubmissionById(submission_id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (userData.role === 'submitter' && submission.submitter_uid !== supabaseUser.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const comment = await createComment({
      submission_id,
      user_uid: supabaseUser.id,
      timestamp_seconds,
      content: content ?? '',
      parent_comment_id,
      attachment_url,
    });

    const emailMap = await getUserEmailMap([comment.user_uid]);
    return NextResponse.json({
      data: {
        ...comment,
        user_email: emailMap[comment.user_uid] || 'Unknown',
      },
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
