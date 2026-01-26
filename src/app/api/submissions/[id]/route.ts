import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helper';
import { getSubmissionById, updateSubmissionStatus } from '@/lib/airtable';
import { updateSubmissionStatusSchema } from '@/lib/validations';
import { DEV_MODE, DEV_SUBMISSIONS } from '@/lib/dev-mode';
import type { Submission } from '@/types';

// In-memory store for dev mode
let devSubmissions = [...DEV_SUBMISSIONS];

function getDevSubmission(id: string): Submission | null {
  return devSubmissions.find(s => s.id === id) || null;
}

function updateDevSubmission(id: string, status: Submission['status']): Submission | null {
  const index = devSubmissions.findIndex(s => s.id === id);
  if (index === -1) return null;
  devSubmissions[index] = { 
    ...devSubmissions[index], 
    status, 
    updated_at: new Date().toISOString().split('T')[0] 
  };
  return devSubmissions[index];
}

// GET /api/submissions/[id] - Get a single submission
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, supabaseUid } = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const submission = DEV_MODE ? getDevSubmission(id) : await getSubmissionById(id);
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
    const { user } = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only reviewers and admins can update status
    if (user.role === 'submitter') {
      return NextResponse.json({ error: 'Only reviewers can update status' }, { status: 403 });
    }

    const submission = DEV_MODE ? getDevSubmission(id) : await getSubmissionById(id);
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
    const updatedSubmission = DEV_MODE 
      ? updateDevSubmission(id, status) 
      : await updateSubmissionStatus(id, status);

    return NextResponse.json({ data: updatedSubmission });
  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
