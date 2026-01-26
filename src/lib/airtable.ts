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
  Annotation,
  AnnotationFields,
  AirtableRecord,
} from '@/types';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_USERS = process.env.AIRTABLE_TABLE_USERS || 'Users';
const AIRTABLE_TABLE_SUBMISSIONS = process.env.AIRTABLE_TABLE_SUBMISSIONS || 'Submissions';
const AIRTABLE_TABLE_COMMENTS = process.env.AIRTABLE_TABLE_COMMENTS || 'Comments';
const AIRTABLE_TABLE_ANNOTATIONS = process.env.AIRTABLE_TABLE_ANNOTATIONS || 'Annotations';

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
  
  return records.map(record => ({
    id: record.id,
    title: record.fields.title,
    description: record.fields.description,
    google_drive_url: record.fields.google_drive_url,
    embed_url: record.fields.embed_url,
    submitter_uid: record.fields.submitter_uid,
    status: record.fields.status,
    created_at: record.fields.created_at,
    updated_at: record.fields.updated_at,
  }));
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
  return {
    id: record.id,
    title: record.fields.title,
    description: record.fields.description,
    google_drive_url: record.fields.google_drive_url,
    embed_url: record.fields.embed_url,
    submitter_uid: record.fields.submitter_uid,
    status: record.fields.status,
    created_at: record.fields.created_at,
    updated_at: record.fields.updated_at,
  };
}

export async function createSubmission(
  submission: Omit<SubmissionFields, 'created_at' | 'updated_at' | 'status'>
): Promise<Submission> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_SUBMISSIONS}`;
  const now = new Date().toISOString().split('T')[0];
  
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      fields: {
        ...submission,
        status: 'pending',
        created_at: now,
        updated_at: now,
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const record: AirtableRecord<SubmissionFields> = await response.json();
  return {
    id: record.id,
    title: record.fields.title,
    description: record.fields.description,
    google_drive_url: record.fields.google_drive_url,
    embed_url: record.fields.embed_url,
    submitter_uid: record.fields.submitter_uid,
    status: record.fields.status,
    created_at: record.fields.created_at,
    updated_at: record.fields.updated_at,
  };
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
  return {
    id: record.id,
    title: record.fields.title,
    description: record.fields.description,
    google_drive_url: record.fields.google_drive_url,
    embed_url: record.fields.embed_url,
    submitter_uid: record.fields.submitter_uid,
    status: record.fields.status,
    created_at: record.fields.created_at,
    updated_at: record.fields.updated_at,
  };
}

// ==================== COMMENTS ====================

export async function getCommentsBySubmission(submissionId: string): Promise<Comment[]> {
  const filterFormula = encodeURIComponent(`{submission_id}="${submissionId}"`);
  const url = `${BASE_URL}/${AIRTABLE_TABLE_COMMENTS}?filterByFormula=${filterFormula}&sort%5B0%5D%5Bfield%5D=timestamp_seconds&sort%5B0%5D%5Bdirection%5D=asc&sort%5B1%5D%5Bfield%5D=created_at&sort%5B1%5D%5Bdirection%5D=asc`;
  
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  const records: AirtableRecord<CommentFields>[] = data.records;
  
  return records.map(record => ({
    id: record.id,
    submission_id: record.fields.submission_id,
    user_uid: record.fields.user_uid,
    timestamp_seconds: record.fields.timestamp_seconds,
    content: record.fields.content,
    parent_comment_id: record.fields.parent_comment_id,
    created_at: record.fields.created_at,
  }));
}

export async function createComment(
  comment: Omit<CommentFields, 'created_at'>
): Promise<Comment> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_COMMENTS}`;
  
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      fields: {
        ...comment,
        created_at: new Date().toISOString().split('T')[0],
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const record: AirtableRecord<CommentFields> = await response.json();
  return {
    id: record.id,
    submission_id: record.fields.submission_id,
    user_uid: record.fields.user_uid,
    timestamp_seconds: record.fields.timestamp_seconds,
    content: record.fields.content,
    parent_comment_id: record.fields.parent_comment_id,
    created_at: record.fields.created_at,
  };
}

// ==================== ANNOTATIONS ====================

export async function getAnnotationsBySubmission(submissionId: string): Promise<Annotation[]> {
  const filterFormula = encodeURIComponent(`{submission_id}="${submissionId}"`);
  const url = `${BASE_URL}/${AIRTABLE_TABLE_ANNOTATIONS}?filterByFormula=${filterFormula}&sort%5B0%5D%5Bfield%5D=timestamp_seconds&sort%5B0%5D%5Bdirection%5D=asc`;
  
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  const records: AirtableRecord<AnnotationFields>[] = data.records;
  
  return records.map(record => ({
    id: record.id,
    submission_id: record.fields.submission_id,
    reviewer_uid: record.fields.reviewer_uid,
    timestamp_seconds: record.fields.timestamp_seconds,
    note: record.fields.note,
    created_at: record.fields.created_at,
  }));
}

export async function createAnnotation(
  annotation: Omit<AnnotationFields, 'created_at'>
): Promise<Annotation> {
  const url = `${BASE_URL}/${AIRTABLE_TABLE_ANNOTATIONS}`;
  
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      fields: {
        ...annotation,
        created_at: new Date().toISOString().split('T')[0],
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable error: ${JSON.stringify(error)}`);
  }
  
  const record: AirtableRecord<AnnotationFields> = await response.json();
  return {
    id: record.id,
    submission_id: record.fields.submission_id,
    reviewer_uid: record.fields.reviewer_uid,
    timestamp_seconds: record.fields.timestamp_seconds,
    note: record.fields.note,
    created_at: record.fields.created_at,
  };
}

// ==================== HELPERS ====================

export async function getUserEmailMap(userUids: string[]): Promise<Record<string, string>> {
  if (userUids.length === 0) return {};
  
  const uniqueUids = [...new Set(userUids)];
  const orConditions = uniqueUids.map(uid => `{supabase_uid}="${uid}"`).join(',');
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
