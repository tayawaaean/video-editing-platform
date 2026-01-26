import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helper';
import { getSubmissions, createSubmission } from '@/lib/airtable';
import { createSubmissionSchema } from '@/lib/validations';
import { parseGoogleDriveUrl } from '@/lib/google-drive';
import { DEV_MODE, DEV_SUBMISSIONS } from '@/lib/dev-mode';
import type { Submission } from '@/types';

// In-memory store for dev mode submissions
let devSubmissions = [...DEV_SUBMISSIONS];

// GET /api/submissions - List submissions (filtered by role)
export async function GET(request: NextRequest) {
  try {
    const { user, supabaseUid } = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;

    let submissions: Submission[];
    
    if (DEV_MODE) {
      // Dev mode - use mock data
      submissions = devSubmissions.filter(s => {
        const matchesStatus = !status || s.status === status;
        const canView = user.role !== 'submitter' || s.submitter_uid === supabaseUid;
        return matchesStatus && canView;
      });
    } else {
      // Production mode
      if (user.role === 'submitter') {
        submissions = await getSubmissions(supabaseUid!, status);
      } else {
        submissions = await getSubmissions(undefined, status);
      }
    }

    return NextResponse.json({ data: submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/submissions - Create a new submission
export async function POST(request: NextRequest) {
  try {
    const { user, supabaseUid } = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = createSubmissionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { title, description, google_drive_url } = validationResult.data;

    // Parse and validate Google Drive URL
    const driveResult = parseGoogleDriveUrl(google_drive_url);
    if (!driveResult.success) {
      return NextResponse.json(
        { error: driveResult.error },
        { status: 400 }
      );
    }

    let submission: Submission;
    
    if (DEV_MODE) {
      // Dev mode - create mock submission
      submission = {
        id: `dev-sub-${Date.now()}`,
        title,
        description: description || '',
        google_drive_url,
        embed_url: driveResult.embedUrl!,
        submitter_uid: supabaseUid!,
        status: 'pending',
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString().split('T')[0],
      };
      devSubmissions.unshift(submission);
    } else {
      // Production mode
      submission = await createSubmission({
        title,
        description: description || '',
        google_drive_url,
        embed_url: driveResult.embedUrl!,
        submitter_uid: supabaseUid!,
      });
    }

    return NextResponse.json({ data: submission }, { status: 201 });
  } catch (error) {
    console.error('Error creating submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
