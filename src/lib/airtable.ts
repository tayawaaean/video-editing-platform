// Server-only Airtable module
// This file should NEVER be imported from client components

import 'server-only';
import type {
  User,
  UserFields,
  Submission,
  SubmissionFields,
  Comment,
  CommentFields,
  Version,
  VersionFields,
  AirtableRecord,
} from '@/types';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_USERS = process.env.AIRTABLE_TABLE_USERS || 'Users';
const AIRTABLE_TABLE_SUBMISSIONS = process.env.AIRTABLE_TABLE_SUBMISSIONS || 'Submissions';
const AIRTABLE_TABLE_FEEDBACK = process.env.AIRTABLE_TABLE_FEEDBACK || 'Feedback';
const AIRTABLE_TABLE_VERSIONS = process.env.AIRTABLE_TABLE_VERSIONS || 'Versions';

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

// Rate limit handling with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
        const delay = Math.min(retryAfter * 1000, 30000) * Math.pow(2, i);
        console.log(`Rate limited. Retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const delay = Math.pow(2, i) * 1000;
      console.log(`Request failed. Retrying after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries reached');
}

function getHeaders() {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// ==================== USERS ====================

export async function getUserBySupabaseUid(supabaseUid: string): Promise<User | null> {
  const filterFormula = encodeURIComponent(`{supabase_uid}="${supabaseUid}"`);
  const url = `${BASE_URL}/${AIRTABLE_TABLE_USERS}?filterByFormula=${filterFormula}&maxRecords=1`;
  
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  const records: AirtableRecord<UserFields>[] = data.records;
  
  if (records.length === 0) {
    return null;
  }
  
  const record = records[0];
  return {
    id: record.id,
    supabase_uid: record.fields.supabase_uid,
    email: record.fields.email,
    role: record.fields.role,
    created_at: record.fields.created_at,
  };
}

export async function getAllUsers(): Promise<User[]> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_USERS}?sort%5B0%5D%5Bfield%5D=created_at&sort%5B0%5D%5Bdirection%5D=desc`;
  
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  const records: AirtableRecord<UserFields>[] = data.records;
  
  return records.map(record => ({
    id: record.id,
    supabase_uid: record.fields.supabase_uid,
    email: record.fields.email,
    role: record.fields.role,
    created_at: record.fields.created_at,
  }));
}

export async function createUser(user: Omit<UserFields, 'created_at'>): Promise<User> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_USERS}`;
  
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      fields: {
        ...user,
        created_at: new Date().toISOString().split('T')[0],
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const record: AirtableRecord<UserFields> = await response.json();
  return {
    id: record.id,
    supabase_uid: record.fields.supabase_uid,
    email: record.fields.email,
    role: record.fields.role,
    created_at: record.fields.created_at,
  };
}

export async function updateUserRole(recordId: string, role: User['role']): Promise<User> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_USERS}/${recordId}`;
  
  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      fields: { role },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const record: AirtableRecord<UserFields> = await response.json();
  return {
    id: record.id,
    supabase_uid: record.fields.supabase_uid,
    email: record.fields.email,
    role: record.fields.role,
    created_at: record.fields.created_at,
  };
}

// ==================== SUBMISSIONS ====================

// Helper function to map Airtable record to Submission object
function mapRecordToSubmission(record: AirtableRecord<SubmissionFields>): Submission {
  return {
    id: record.id,
    title: record.fields.title,
    description: record.fields.description,
    google_drive_url: record.fields.google_drive_url,
    embed_url: record.fields.embed_url,
    submitter_uid: record.fields.submitter_uid,
    status: record.fields.status,
    video_source: record.fields.video_source || 'google_drive', // Default for legacy records
    firebase_video_path: record.fields.firebase_video_path,
    firebase_video_url: record.fields.firebase_video_url,
    firebase_video_size: record.fields.firebase_video_size,
    revision_round: record.fields.revision_round ?? 1,
    revision_requested_at: record.fields.revision_requested_at,
    created_at: record.fields.created_at,
    updated_at: record.fields.updated_at,
  };
}

export async function getSubmissions(
  userUid?: string,
  status?: string
): Promise<Submission[]> {
  let filterFormula = '';
  const filters: string[] = [];
  
  if (userUid) {
    filters.push(`{submitter_uid}="${userUid}"`);
  }
  if (status) {
    filters.push(`{status}="${status}"`);
  }
  
  if (filters.length > 0) {
    filterFormula = filters.length === 1 
      ? filters[0] 
      : `AND(${filters.join(',')})`;
  }
  
  let url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}?sort%5B0%5D%5Bfield%5D=created_at&sort%5B0%5D%5Bdirection%5D=desc`;
  if (filterFormula) {
    url += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
  }
  
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  const records: AirtableRecord<SubmissionFields>[] = data.records;
  
  return records.map(mapRecordToSubmission);
}

/**
 * Returns total bytes of Firebase storage used by submissions AND versions still on Firebase.
 * Used to enforce storage quota before allowing new Firebase uploads.
 * Requires firebase_video_size (Number) on both Submissions and Versions tables in Airtable.
 */
export async function getFirebaseStorageUsed(): Promise<number> {
  let total = 0;

  // Count submissions on Firebase
  const submissionFilter = encodeURIComponent(
    `AND({video_source}="firebase", LEN({firebase_video_path})>0)`
  );
  const submissionUrl = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}?filterByFormula=${submissionFilter}&fields[]=firebase_video_size`;
  const submissionResponse = await fetchWithRetry(submissionUrl, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!submissionResponse.ok) {
    const error = await submissionResponse.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  const submissionData = await submissionResponse.json();
  const submissionRecords: AirtableRecord<SubmissionFields>[] = submissionData.records;
  for (const record of submissionRecords) {
    const size = record.fields.firebase_video_size;
    if (typeof size === 'number' && size > 0) total += size;
  }

  // Count versions on Firebase (resubmissions that haven't been cleaned up yet)
  const versionFilter = encodeURIComponent(
    `AND({video_source}="firebase", LEN({firebase_video_path})>0)`
  );
  const versionUrl = `${BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_VERSIONS)}?filterByFormula=${versionFilter}&fields[]=firebase_video_size`;
  const versionResponse = await fetchWithRetry(versionUrl, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (versionResponse.ok) {
    const versionData = await versionResponse.json();
    const versionRecords: AirtableRecord<VersionFields>[] = versionData.records;
    for (const record of versionRecords) {
      const size = record.fields.firebase_video_size;
      if (typeof size === 'number' && size > 0) total += size;
    }
  }

  return total;
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}/${id}`;
  
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const record: AirtableRecord<SubmissionFields> = await response.json();
  return mapRecordToSubmission(record);
}

export async function createSubmission(
  submission: Omit<SubmissionFields, 'created_at' | 'updated_at' | 'status'>
): Promise<Submission> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}`;
  const now = new Date().toISOString().split('T')[0];
  
  // Build fields object. Only send video_source and Firebase fields for Firebase submissions
  // so bases without these columns (legacy) still work for Google Drive submissions.
  const fields: Record<string, unknown> = {
    title: submission.title,
    description: submission.description || '',
    embed_url: submission.embed_url,
    submitter_uid: submission.submitter_uid,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  if (submission.google_drive_url) {
    fields.google_drive_url = submission.google_drive_url;
  }

  // New columns required for Firebase uploads; omit for legacy Airtable bases
  if (submission.video_source === 'firebase') {
    fields.video_source = submission.video_source;
    if (submission.firebase_video_url) {
      fields.firebase_video_url = submission.firebase_video_url;
    }
    if (submission.firebase_video_path) {
      fields.firebase_video_path = submission.firebase_video_path;
    }
    if (submission.firebase_video_size != null) {
      fields.firebase_video_size = submission.firebase_video_size;
    }
  }
  
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const record: AirtableRecord<SubmissionFields> = await response.json();
  return mapRecordToSubmission(record);
}

/**
 * Update submission status. The Airtable Status field must be a Single select
 * with exactly these options: pending, reviewing, approved, revision_requested.
 * Add any missing options in Airtable field settings or updates will fail.
 */
export async function updateSubmissionStatus(
  id: string,
  status: Submission['status'],
  extraFields?: Record<string, unknown>
): Promise<Submission> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}/${id}`;

  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      fields: {
        status,
        updated_at: new Date().toISOString().split('T')[0],
        ...extraFields,
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const record: AirtableRecord<SubmissionFields> = await response.json();
  return mapRecordToSubmission(record);
}

/**
 * Update submission after archiving to Google Drive
 * Clears Firebase fields and sets Google Drive URL
 */
export async function updateSubmissionAfterArchive(
  id: string,
  googleDriveUrl: string,
  embedUrl: string
): Promise<Submission> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}/${id}`;
  
  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      fields: {
        google_drive_url: googleDriveUrl,
        embed_url: embedUrl,
        video_source: 'google_drive',
        // Clear Firebase fields by setting to empty (Airtable will remove them)
        firebase_video_url: '',
        firebase_video_path: '',
        updated_at: new Date().toISOString().split('T')[0],
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const record: AirtableRecord<SubmissionFields> = await response.json();
  return mapRecordToSubmission(record);
}

// ==================== FEEDBACK (Comments) ====================

export async function getCommentsBySubmission(submissionId: string): Promise<Comment[]> {
  const filterFormula = encodeURIComponent(`{submission_id}="${submissionId}"`);
  const url = `${BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_FEEDBACK)}?filterByFormula=${filterFormula}&sort%5B0%5D%5Bfield%5D=timestamp_seconds&sort%5B0%5D%5Bdirection%5D=asc&sort%5B1%5D%5Bfield%5D=created_at&sort%5B1%5D%5Bdirection%5D=asc`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: { message?: string } = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    if (response.status === 403) {
      throw new Error(
        `Airtable table "${AIRTABLE_TABLE_FEEDBACK}" not found or no access. ` +
        `Verify the table exists and the API token has access. Original: ${JSON.stringify(errorData)}`
      );
    }
    throw new Error(`Airtable error (${response.status}): ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const records: AirtableRecord<CommentFields>[] = data.records;

  return records.map(record => {
    // Airtable Attachment fields return an array of objects: [{ url, filename, size, type }]
    // Extract the URL from the first attachment if present
    let attachmentUrl: string | undefined;
    const attachmentField = record.fields.attachment_url;
    if (Array.isArray(attachmentField) && attachmentField.length > 0) {
      attachmentUrl = attachmentField[0]?.url;
    } else if (typeof attachmentField === 'string') {
      // Fallback for string format (shouldn't happen but handle gracefully)
      attachmentUrl = attachmentField;
    }

    // Airtable "Link to another record" fields return an array of record IDs
    // Extract the first ID if present
    let parentCommentId: string | undefined;
    const parentField = record.fields.parent_comment_id;
    if (Array.isArray(parentField) && parentField.length > 0) {
      parentCommentId = parentField[0];
    } else if (typeof parentField === 'string') {
      parentCommentId = parentField;
    }

    return {
      id: record.id,
      submission_id: record.fields.submission_id,
      user_uid: record.fields.user_uid,
      timestamp_seconds: record.fields.timestamp_seconds,
      content: record.fields.content || '',
      parent_comment_id: parentCommentId,
      attachment_url: attachmentUrl,
      attachment_pin_x: record.fields.attachment_pin_x,
      attachment_pin_y: record.fields.attachment_pin_y,
      attachment_pin_comment: record.fields.attachment_pin_comment,
      revision_round: record.fields.revision_round ?? 1,
      created_at: record.fields.created_at,
    };
  });
}

export async function createComment(comment: Omit<CommentFields, 'created_at'>): Promise<Comment> {
  const url = `${BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_FEEDBACK)}`;

  // Build fields object
  const fields: Record<string, unknown> = {
    submission_id: comment.submission_id,
    user_uid: comment.user_uid,
    timestamp_seconds: comment.timestamp_seconds,
    content: comment.content,
    created_at: new Date().toISOString().split('T')[0],
  };

  // Only include parent_comment_id if it exists
  if (comment.parent_comment_id) {
    fields.parent_comment_id = comment.parent_comment_id;
  }

  // Format attachment for Airtable's Attachment field type
  // Airtable expects an array of objects: [{ url: "https://..." }]
  // The URL must be publicly accessible - Airtable will fetch and store the file
  if (comment.attachment_url && comment.attachment_url.startsWith('http')) {
    fields.attachment_url = [{ url: comment.attachment_url }];
  }

  // Pin-on-frame (Loom-style): add Number fields "attachment_pin_x" and "attachment_pin_y" (0-1) to Feedback table in Airtable
  // Also add "attachment_pin_comment" (Long text) field for pin comments
  if (comment.attachment_pin_x != null && comment.attachment_pin_y != null) {
    fields.attachment_pin_x = comment.attachment_pin_x;
    fields.attachment_pin_y = comment.attachment_pin_y;
  }
  if (comment.attachment_pin_comment) {
    fields.attachment_pin_comment = comment.attachment_pin_comment;
  }

  if (comment.revision_round != null) {
    fields.revision_round = comment.revision_round;
  }

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: { message?: string } = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    throw new Error(`Airtable error (${response.status}): ${JSON.stringify(errorData)}`);
  }

  const record: AirtableRecord<CommentFields> = await response.json();

  // Extract URL from Airtable's attachment array format
  let attachmentUrl: string | undefined;
  const attachmentField = record.fields.attachment_url;
  if (Array.isArray(attachmentField) && attachmentField.length > 0) {
    attachmentUrl = attachmentField[0]?.url;
  } else if (typeof attachmentField === 'string') {
    attachmentUrl = attachmentField;
  }

  // Extract parent_comment_id from linked record array format
  let parentCommentId: string | undefined;
  const parentField = record.fields.parent_comment_id;
  if (Array.isArray(parentField) && parentField.length > 0) {
    parentCommentId = parentField[0];
  } else if (typeof parentField === 'string') {
    parentCommentId = parentField;
  }

  return {
    id: record.id,
    submission_id: record.fields.submission_id,
    user_uid: record.fields.user_uid,
    timestamp_seconds: record.fields.timestamp_seconds,
    content: record.fields.content || '',
    parent_comment_id: parentCommentId,
    attachment_url: attachmentUrl,
    attachment_pin_x: record.fields.attachment_pin_x,
    attachment_pin_y: record.fields.attachment_pin_y,
    attachment_pin_comment: record.fields.attachment_pin_comment,
    revision_round: record.fields.revision_round ?? 1,
    created_at: record.fields.created_at,
  };
}

export async function getCommentById(commentId: string): Promise<Comment | null> {
  const url = `${BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_FEEDBACK)}/${commentId}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const errorText = await response.text();
    throw new Error(`Airtable error (${response.status}): ${errorText}`);
  }

  const record: AirtableRecord<CommentFields> = await response.json();

  let attachmentUrl: string | undefined;
  const attachmentField = record.fields.attachment_url;
  if (Array.isArray(attachmentField) && attachmentField.length > 0) {
    attachmentUrl = attachmentField[0]?.url;
  } else if (typeof attachmentField === 'string') {
    attachmentUrl = attachmentField;
  }

  let parentCommentId: string | undefined;
  const parentField = record.fields.parent_comment_id;
  if (Array.isArray(parentField) && parentField.length > 0) {
    parentCommentId = parentField[0];
  } else if (typeof parentField === 'string') {
    parentCommentId = parentField;
  }

  return {
    id: record.id,
    submission_id: record.fields.submission_id,
    user_uid: record.fields.user_uid,
    timestamp_seconds: record.fields.timestamp_seconds,
    content: record.fields.content || '',
    parent_comment_id: parentCommentId,
    attachment_url: attachmentUrl,
    attachment_pin_x: record.fields.attachment_pin_x,
    attachment_pin_y: record.fields.attachment_pin_y,
    attachment_pin_comment: record.fields.attachment_pin_comment,
    revision_round: record.fields.revision_round ?? 1,
    created_at: record.fields.created_at,
  };
}

export async function deleteComment(commentId: string): Promise<void> {
  const url = `${BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_FEEDBACK)}/${commentId}`;

  const response = await fetchWithRetry(url, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable error (${response.status}): ${errorText}`);
  }
}

// ==================== SUBMISSION DELETE / EDIT / RESUBMIT ====================

export async function deleteSubmission(id: string): Promise<void> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}/${id}`;
  const response = await fetchWithRetry(url, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable error (${response.status}): ${errorText}`);
  }
}

export async function deleteCommentsBySubmission(submissionId: string): Promise<void> {
  const comments = await getCommentsBySubmission(submissionId);
  if (comments.length === 0) return;

  // Airtable batch delete supports up to 10 records per request
  for (let i = 0; i < comments.length; i += 10) {
    const batch = comments.slice(i, i + 10);
    const params = batch.map(c => `records[]=${c.id}`).join('&');
    const url = `${BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_FEEDBACK)}?${params}`;
    const response = await fetchWithRetry(url, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable error (${response.status}): ${errorText}`);
    }
  }
}

export async function updateSubmissionMetadata(
  id: string,
  fields: { title?: string; description?: string }
): Promise<Submission> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}/${id}`;
  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString().split('T')[0],
  };
  if (fields.title !== undefined) updateFields.title = fields.title;
  if (fields.description !== undefined) updateFields.description = fields.description;

  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ fields: updateFields }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  const record: AirtableRecord<SubmissionFields> = await response.json();
  return mapRecordToSubmission(record);
}

export async function updateSubmissionForResubmit(
  id: string,
  fields: Record<string, unknown>
): Promise<Submission> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}/${id}`;
  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      fields: {
        ...fields,
        status: 'pending',
        updated_at: new Date().toISOString().split('T')[0],
      },
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  const record: AirtableRecord<SubmissionFields> = await response.json();
  return mapRecordToSubmission(record);
}

// ==================== VERSIONS ====================
// Versions table should have root_submission_id (Single line text) - same value as submission_id.
// Used when deleting Firebase files so we only delete versions belonging to that submission.

export async function getVersionsBySubmission(submissionId: string): Promise<Version[]> {
  const filterFormula = encodeURIComponent(`{submission_id}="${submissionId}"`);
  const url = `${BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_VERSIONS)}?filterByFormula=${filterFormula}&sort%5B0%5D%5Bfield%5D=version_number&sort%5B0%5D%5Bdirection%5D=desc`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!response.ok) {
    if (response.status === 404 || response.status === 403) return [];
    const errorText = await response.text();
    throw new Error(`Airtable error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const records: AirtableRecord<VersionFields>[] = data.records;
  return records.map(record => ({
    id: record.id,
    submission_id: record.fields.submission_id,
    root_submission_id: record.fields.root_submission_id,
    version_number: record.fields.version_number,
    video_source: record.fields.video_source,
    embed_url: record.fields.embed_url,
    google_drive_url: record.fields.google_drive_url,
    firebase_video_url: record.fields.firebase_video_url,
    firebase_video_path: record.fields.firebase_video_path,
    firebase_video_size: record.fields.firebase_video_size,
    created_at: record.fields.created_at,
  }));
}

export async function createVersion(version: Omit<VersionFields, 'created_at'>): Promise<Version> {
  const url = `${BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_VERSIONS)}`;
  const fields: Record<string, unknown> = {
    submission_id: version.submission_id,
    root_submission_id: version.root_submission_id ?? version.submission_id,
    version_number: version.version_number,
    video_source: version.video_source,
    embed_url: version.embed_url,
    created_at: new Date().toISOString().split('T')[0],
  };
  if (version.google_drive_url) fields.google_drive_url = version.google_drive_url;
  if (version.firebase_video_url) fields.firebase_video_url = version.firebase_video_url;
  if (version.firebase_video_path) fields.firebase_video_path = version.firebase_video_path;
  if (version.firebase_video_size != null) fields.firebase_video_size = version.firebase_video_size;

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  const record: AirtableRecord<VersionFields> = await response.json();
  return {
    id: record.id,
    submission_id: record.fields.submission_id,
    root_submission_id: record.fields.root_submission_id,
    version_number: record.fields.version_number,
    video_source: record.fields.video_source,
    embed_url: record.fields.embed_url,
    google_drive_url: record.fields.google_drive_url,
    firebase_video_url: record.fields.firebase_video_url,
    firebase_video_path: record.fields.firebase_video_path,
    firebase_video_size: record.fields.firebase_video_size,
    created_at: record.fields.created_at,
  };
}

export async function deleteVersionsBySubmission(submissionId: string): Promise<void> {
  const versions = await getVersionsBySubmission(submissionId);
  if (versions.length === 0) return;

  for (let i = 0; i < versions.length; i += 10) {
    const batch = versions.slice(i, i + 10);
    const params = batch.map(v => `records[]=${v.id}`).join('&');
    const url = `${BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_VERSIONS)}?${params}`;
    const response = await fetchWithRetry(url, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable error (${response.status}): ${errorText}`);
    }
  }
}

/**
 * Get all Firebase video paths for a submission (including versions that belong to this submission).
 * Only includes versions where root_submission_id matches, so we never delete another submission's files.
 */
export async function getFirebasePathsForSubmission(submissionId: string): Promise<string[]> {
  const paths: string[] = [];
  
  // Get current submission's Firebase path (only this submission)
  const submission = await getSubmissionById(submissionId);
  if (submission?.video_source === 'firebase' && submission.firebase_video_path) {
    paths.push(submission.firebase_video_path);
  }
  
  // Get versions for this submission; only include paths for versions that belong to this root
  const versions = await getVersionsBySubmission(submissionId);
  for (const version of versions) {
    const belongsToThisSubmission =
      version.root_submission_id === submissionId ||
      (!version.root_submission_id && version.submission_id === submissionId);
    if (
      belongsToThisSubmission &&
      version.video_source === 'firebase' &&
      version.firebase_video_path
    ) {
      paths.push(version.firebase_video_path);
    }
  }
  
  return paths;
}

/**
 * Clear Firebase fields from all versions of a submission after archiving.
 * Only clears versions that belong to this submission (root_submission_id match).
 */
export async function clearVersionsFirebaseFields(submissionId: string): Promise<void> {
  const versions = await getVersionsBySubmission(submissionId);
  const belongsToThis = (v: Version) =>
    v.root_submission_id === submissionId || (!v.root_submission_id && v.submission_id === submissionId);
  const firebaseVersions = versions.filter(
    v => belongsToThis(v) && v.video_source === 'firebase' && v.firebase_video_path
  );
  
  if (firebaseVersions.length === 0) return;

  // Update in batches of 10 (Airtable limit)
  for (let i = 0; i < firebaseVersions.length; i += 10) {
    const batch = firebaseVersions.slice(i, i + 10);
    const records = batch.map(v => ({
      id: v.id,
      fields: {
        video_source: 'google_drive', // Mark as archived
        firebase_video_url: '',
        firebase_video_path: '',
        firebase_video_size: 0,
      },
    }));

    const url = `${BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_VERSIONS)}`;
    const response = await fetchWithRetry(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ records }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to clear Firebase fields from versions: ${errorText}`);
    }
  }
}

// ==================== HELPERS ====================

export async function getUserEmailMap(userUids: string[]): Promise<Record<string, string>> {
  const validUids = userUids.filter((uid): uid is string => typeof uid === 'string' && uid.length > 0);
  if (validUids.length === 0) return {};
  
  const uniqueUids = [...new Set(validUids)];
  const orConditions = uniqueUids.map(uid => `{supabase_uid}="${String(uid).replace(/"/g, '')}"`).join(',');
  const filterFormula = encodeURIComponent(`OR(${orConditions})`);
  const url = `${BASE_URL}/${AIRTABLE_TABLE_USERS}?filterByFormula=${filterFormula}`;
  
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  const records: AirtableRecord<UserFields>[] = data.records;
  
  const emailMap: Record<string, string> = {};
  records.forEach(record => {
    emailMap[record.fields.supabase_uid] = record.fields.email;
  });
  
  return emailMap;
}
