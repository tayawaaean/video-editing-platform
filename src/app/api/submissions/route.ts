import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSubmissions, createSubmission } from '@/lib/airtable';
import { createSubmissionSchema, createSubmissionLegacySchema } from '@/lib/validations';
import { parseGoogleDriveUrl } from '@/lib/google-drive';
import type { Submission, VideoSource } from '@/types';

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
    
    // Try the new schema first, then fall back to legacy
    let validatedData: {
      title: string;
      description?: string;
      video_source: VideoSource;
      google_drive_url?: string;
      firebase_video_url?: string;
      firebase_video_path?: string;
      embed_url: string;
    };

    // Check if it's the new format with video_source
    if (body.video_source) {
      const validationResult = createSubmissionSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: validationResult.error.issues[0].message },
          { status: 400 }
        );
      }

      const data = validationResult.data;
      
      if (data.video_source === 'google_drive') {
        // Parse and validate Google Drive URL
        const driveResult = parseGoogleDriveUrl(data.google_drive_url);
        if (!driveResult.success) {
          return NextResponse.json(
            { error: driveResult.error },
            { status: 400 }
          );
        }
        
        validatedData = {
          title: data.title,
          description: data.description,
          video_source: 'google_drive',
          google_drive_url: data.google_drive_url,
          embed_url: driveResult.embedUrl!,
        };
      } else {
        // Firebase upload
        validatedData = {
          title: data.title,
          description: data.description,
          video_source: 'firebase',
          firebase_video_url: data.firebase_video_url,
          firebase_video_path: data.firebase_video_path,
          embed_url: data.firebase_video_url, // Use Firebase URL as embed URL
        };
      }
    } else {
      // Legacy format - assume Google Drive
      const validationResult = createSubmissionLegacySchema.safeParse(body);
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

      validatedData = {
        title,
        description,
        video_source: 'google_drive',
        google_drive_url,
        embed_url: driveResult.embedUrl!,
      };
    }

    // Create submission in Airtable
    try {
      const submission = await createSubmission({
        title: validatedData.title,
        description: validatedData.description || '',
        google_drive_url: validatedData.google_drive_url,
        embed_url: validatedData.embed_url,
        submitter_uid: userId,
        video_source: validatedData.video_source,
        firebase_video_url: validatedData.firebase_video_url,
        firebase_video_path: validatedData.firebase_video_path,
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
