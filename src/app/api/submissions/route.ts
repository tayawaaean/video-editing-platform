import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSubmissions, createSubmission } from '@/lib/airtable';
import { createSubmissionSchema } from '@/lib/validations';
import { parseGoogleDriveUrl } from '@/lib/google-drive';
import type { Submission } from '@/types';

// GET /api/submissions - List submissions (filtered by role)
export async function GET(request: NextRequest) {
  try {
    // Simple auth - same as /api/me
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

    // Get user from Airtable (simple approach)
    const { getUserBySupabaseUid } = await import('@/lib/airtable');
    const userData = await getUserBySupabaseUid(supabaseUser.id);

    if (!userData) {
      return NextResponse.json({ error: 'User not found in Airtable' }, { status: 403 });
    }

    const user = userData;
    const supabaseUid = supabaseUser.id;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;

    // Always use Airtable
    let submissions: Submission[];
    if (user.role === 'submitter') {
      submissions = await getSubmissions(supabaseUid!, status);
    } else {
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
    // Simple auth - same as /api/me
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

    // Get user from Airtable (simple approach)
    const { getUserBySupabaseUid } = await import('@/lib/airtable');
    const userData = await getUserBySupabaseUid(supabaseUser.id);

    if (!userData) {
      return NextResponse.json({ error: 'User not found in Airtable' }, { status: 403 });
    }

    const user = userData;
    const supabaseUid = supabaseUser.id;

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

    // Always create in Airtable
    try {
      const submission = await createSubmission({
        title,
        description: description || '',
        google_drive_url,
        embed_url: driveResult.embedUrl!,
        submitter_uid: supabaseUid!,
      });

      console.log('Submission created successfully in Airtable:', submission.id);
      return NextResponse.json({ data: submission }, { status: 201 });
    } catch (createError) {
      console.error('Error creating submission in Airtable:', createError);
      const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to create submission in Airtable: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/submissions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
