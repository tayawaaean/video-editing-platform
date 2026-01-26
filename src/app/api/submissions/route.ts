import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserBySupabaseUid, getSubmissions, createSubmission } from '@/lib/airtable';
import { createSubmissionSchema } from '@/lib/validations';
import { parseGoogleDriveUrl } from '@/lib/google-drive';

// GET /api/submissions - List submissions (filtered by role)
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;

    let submissions;
    if (airtableUser.role === 'submitter') {
      // Submitters can only see their own submissions
      submissions = await getSubmissions(user.id, status);
    } else {
      // Reviewers and admins can see all submissions
      submissions = await getSubmissions(undefined, status);
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

    // Create submission
    const submission = await createSubmission({
      title,
      description: description || '',
      google_drive_url,
      embed_url: driveResult.embedUrl!,
      submitter_uid: user.id,
    });

    return NextResponse.json({ data: submission }, { status: 201 });
  } catch (error) {
    console.error('Error creating submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
