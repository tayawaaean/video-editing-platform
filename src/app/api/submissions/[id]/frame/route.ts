import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSubmissionById } from '@/lib/airtable';
import { getDriveDirectDownloadUrl } from '@/lib/google-drive';
import { checkFfmpegAvailable, extractFrameAtTimestamp } from '@/lib/frame-extract';

const FRAME_CAPTURE_UNAVAILABLE_REASON =
  process.env.VERCEL === '1'
    ? 'Automatic frame capture is not available on Vercel (no ffmpeg). Enter the timestamp and attach a screenshot of the frame, or use a direct video URL for in-browser capture.'
    : 'Frame capture requires ffmpeg on the server. Install ffmpeg and ensure it is in PATH, or enter the timestamp and attach a screenshot.';

/**
 * POST /api/submissions/[id]/frame
 * Extracts a single frame from the submission video at the given timestamp.
 * Body: { timestamp_seconds: number }
 * Returns: { imageDataUrl: string, timestamp_seconds: number }
 * Not available on Vercel (no ffmpeg). On other hosts, requires ffmpeg in PATH.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (process.env.VERCEL === '1') {
      return NextResponse.json(
        { error: FRAME_CAPTURE_UNAVAILABLE_REASON },
        { status: 503 }
      );
    }

    const { id: submissionId } = await params;

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

    const submission = await getSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (userData.role === 'submitter' && submission.submitter_uid !== supabaseUser.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const timestamp_seconds = typeof body?.timestamp_seconds === 'number' ? body.timestamp_seconds : undefined;
    if (timestamp_seconds === undefined || timestamp_seconds < 0) {
      return NextResponse.json(
        { error: 'timestamp_seconds (number >= 0) is required' },
        { status: 400 }
      );
    }

    const embedUrl = submission.embed_url;
    const isDrive = embedUrl.includes('drive.google.com');
    const videoUrl = isDrive ? getDriveDirectDownloadUrl(embedUrl) : embedUrl;

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Could not resolve video URL for frame extraction' },
        { status: 400 }
      );
    }

    await checkFfmpegAvailable();

    const result = await extractFrameAtTimestamp({
      videoUrl,
      timestamp_seconds,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Frame extraction failed';
    const isFfmpegUnavailable = message.includes('ffmpeg not found') || message.includes('ENOENT');
    const status = isFfmpegUnavailable ? 503 : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
