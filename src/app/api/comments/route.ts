import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { getCommentsBySubmission, createComment, getSubmissionById, getUserEmailMap } from '@/lib/airtable';
import { createCommentSchema } from '@/lib/validations';

const BUCKET_NAME = 'attachments';

// Upload a data URL to Supabase Storage and return the public URL
async function uploadDataUrlToStorage(dataUrl: string, oderId: string): Promise<string | null> {
  // Parse data URL
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) return null;

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Determine file extension
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  const ext = extMap[mimeType] || 'png';

  // Generate unique filename
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const filename = `${oderId}/${timestamp}_${randomId}.${ext}`;

  // Create admin client for storage operations
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Ensure bucket exists
  const { data: buckets } = await adminClient.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

  if (!bucketExists) {
    await adminClient.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024 * 1024, // 5GB
    });
  }

  // Upload file
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from(BUCKET_NAME)
    .upload(filename, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    return null;
  }

  // Get public URL
  const { data: urlData } = adminClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(uploadData.path);

  return urlData.publicUrl;
}

// GET /api/comments?submission_id=xxx - Get feedback (comments) for a submission
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, role } = session.user;

    const submissionId = request.nextUrl.searchParams.get('submission_id');
    if (!submissionId) {
      return NextResponse.json({ error: 'submission_id is required' }, { status: 400 });
    }

    const submission = await getSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Submitters can only view comments on their own submissions
    if (role === 'submitter' && submission.submitter_uid !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const comments = await getCommentsBySubmission(submissionId);
    const userUids = comments.map(c => c.user_uid).filter((uid): uid is string => typeof uid === 'string' && uid.length > 0);
    let emailMap: Record<string, string> = {};
    try {
      emailMap = await getUserEmailMap(userUids);
    } catch (emailError) {
      console.warn('User email lookup failed, comments will show Unknown:', emailError);
    }
    const commentsWithEmails = comments.map(comment => ({
      ...comment,
      user_email: (comment.user_uid && emailMap[comment.user_uid]) || 'Unknown',
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
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, role, email } = session.user;

    const body = await request.json();
    const validationResult = createCommentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { submission_id, timestamp_seconds, content, parent_comment_id, attachment_url, attachment_pin_x, attachment_pin_y, attachment_pin_comment } = validationResult.data;

    const submission = await getSubmissionById(submission_id);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Submitters can only comment on their own submissions
    if (role === 'submitter' && submission.submitter_uid !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Submitters may only reply to feedback, not post new top-level feedback
    if (role === 'submitter' && !parent_comment_id) {
      return NextResponse.json(
        { error: 'Submitters can only reply to existing feedback' },
        { status: 403 }
      );
    }

    // If attachment_url is a data URL, upload it to Supabase Storage first
    let finalAttachmentUrl = attachment_url;
    if (attachment_url && attachment_url.startsWith('data:')) {
      const uploadedUrl = await uploadDataUrlToStorage(attachment_url, userId);
      if (uploadedUrl) {
        finalAttachmentUrl = uploadedUrl;
      } else {
        // If upload fails, continue without attachment
        finalAttachmentUrl = undefined;
        console.warn('Failed to upload attachment, continuing without it');
      }
    }

    const comment = await createComment({
      submission_id,
      user_uid: userId,
      timestamp_seconds,
      content: content ?? '',
      parent_comment_id,
      attachment_url: finalAttachmentUrl,
      ...(attachment_pin_x != null && attachment_pin_y != null && { attachment_pin_x, attachment_pin_y }),
      ...(attachment_pin_comment && { attachment_pin_comment }),
    });

    return NextResponse.json({
      data: {
        ...comment,
        user_email: email,
      },
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
