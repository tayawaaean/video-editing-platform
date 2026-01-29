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
  AirtableRecord,
} from '@/types';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_USERS = process.env.AIRTABLE_TABLE_USERS || 'Users';
const AIRTABLE_TABLE_SUBMISSIONS = process.env.AIRTABLE_TABLE_SUBMISSIONS || 'Submissions';
const AIRTABLE_TABLE_FEEDBACK = process.env.AIRTABLE_TABLE_FEEDBACK || 'Feedback';

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
 * Returns total bytes of Firebase storage used by submissions still on Firebase.
 * Used to enforce storage quota before allowing new Firebase uploads.
 * Requires firebase_video_size (Number) on Submissions table in Airtable.
 */
export async function getFirebaseStorageUsed(): Promise<number> {
  const filterFormula = encodeURIComponent(
    `AND({video_source}="firebase", LEN({firebase_video_path})>0)`
  );
  const url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}?filterByFormula=${filterFormula}&fields[]=firebase_video_size`;
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
  let total = 0;
  for (const record of records) {
    const size = record.fields.firebase_video_size;
    if (typeof size === 'number' && size > 0) total += size;
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

export async function updateSubmissionStatus(
  id: string,
  status: Submission['status']
): Promise<Submission> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}/${id}`;
  
  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      fields: {
        status,
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
