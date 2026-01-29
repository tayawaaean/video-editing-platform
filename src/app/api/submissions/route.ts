import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSubmissions, createSubmission, getFirebaseStorageUsed } from '@/lib/airtable';
import { createSubmissionSchema } from '@/lib/validations';
import type { Submission } from '@/types';

// GET /api/submissions - List submissions (filtered by role)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, role } = session.user;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;

    // Get submissions - submitters only see their own
    let submissions: Submission[];
    if (role === 'submitter') {
      submissions = await getSubmissions(userId, status);
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
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = session.user;

    const body = await request.json();
    const FIREBASE_STORAGE_LIMIT_BYTES = Number(process.env.FIREBASE_STORAGE_LIMIT_BYTES) || 1073741824; // 1GB default

    const validationResult = createSubmissionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const newSize = data.firebase_video_size;
    const MAX_FILE_BYTES = 150 * 1024 * 1024; // 150MB
    if (newSize > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'Video file must be 150MB or less.' },
        { status: 413 }
      );
    }
    const used = await getFirebaseStorageUsed();
    if (used + newSize > FIREBASE_STORAGE_LIMIT_BYTES) {
      const limitGB = (FIREBASE_STORAGE_LIMIT_BYTES / (1024 * 1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          error: `Firebase storage limit reached (${limitGB} GB). Used: ${(used / (1024 * 1024 * 1024)).toFixed(2)} GB. This upload would exceed the limit.`,
        },
        { status: 413 }
      );
    }

    try {
      const submission = await createSubmission({
        title: data.title,
        description: data.description || '',
        embed_url: data.firebase_video_url,
        submitter_uid: userId,
        video_source: 'firebase',
        firebase_video_url: data.firebase_video_url,
        firebase_video_path: data.firebase_video_path,
        firebase_video_size: data.firebase_video_size,
      });

      console.log('Submission created successfully in Airtable:', submission.id);
      return NextResponse.json({ data: submission }, { status: 201 });
    } catch (createError) {
      console.error('Error creating submission in Airtable:', createError);
      const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to create submission: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/submissions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
