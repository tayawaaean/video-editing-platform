import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSubmissionById, updateSubmissionStatus } from '@/lib/airtable';
import { updateSubmissionStatusSchema } from '@/lib/validations';
import type { Submission } from '@/types';

// GET /api/submissions/[id] - Get a single submission
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Simple auth - same as /api/submissions
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

    // Get user from Airtable
    const { getUserBySupabaseUid } = await import('@/lib/airtable');
    const userData = await getUserBySupabaseUid(supabaseUser.id);

    if (!userData) {
      return NextResponse.json({ error: 'User not found in Airtable' }, { status: 403 });
    }

    const user = userData;
    const supabaseUid = supabaseUser.id;

    // Always fetch from Airtable
    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Submitters can only view their own submissions
    if (user.role === 'submitter' && submission.submitter_uid !== supabaseUid) {
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
    
    // Simple auth - same as /api/submissions
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

    // Get user from Airtable
    const { getUserBySupabaseUid } = await import('@/lib/airtable');
    const userData = await getUserBySupabaseUid(supabaseUser.id);

    if (!userData) {
      return NextResponse.json({ error: 'User not found in Airtable' }, { status: 403 });
    }

    const user = userData;

    // Only reviewers and admins can update status
    if (user.role === 'submitter') {
      return NextResponse.json({ error: 'Only reviewers can update status' }, { status: 403 });
    }

    // Always fetch from Airtable
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

    // Always update in Airtable
    const updatedSubmission = await updateSubmissionStatus(id, status);

    return NextResponse.json({ data: updatedSubmission });
  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
