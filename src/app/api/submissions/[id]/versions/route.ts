import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSubmissionById, getVersionsBySubmission } from '@/lib/airtable';

// GET /api/submissions/[id]/versions - Get version history
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

    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Submitters can only view their own submission versions
    if (role === 'submitter' && submission.submitter_uid !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const versions = await getVersionsBySubmission(id);

    return NextResponse.json({ data: versions });
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
