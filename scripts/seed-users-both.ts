/**
 * Seed the same users into BOTH Supabase and Airtable.
 * One list, both systems in sync. Use for initial setup or adding users.
 *
 * Run: npx tsx scripts/seed-users-both.ts
 *
 * Set SEED_DEFAULT_PASSWORD in .env.local or leave unset (uses ChangeMe123!).
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_USERS = process.env.AIRTABLE_TABLE_USERS || 'Users';
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!';

const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

type Role = 'admin' | 'reviewer' | 'submitter';

interface SeedUser {
  email: string;
  role: Role;
  password?: string;
}

// Edit this list; same users will be created in Supabase and Airtable
const SEED_USERS: SeedUser[] = [
  { email: 'admin@example.com', role: 'admin' },
  { email: 'reviewer@example.com', role: 'reviewer' },
  { email: 'submitter@example.com', role: 'submitter' },
];

function validRole(r: string): r is Role {
  return ['admin', 'reviewer', 'submitter'].includes(r);
}

async function findAirtableUserByEmail(
  email: string,
  headers: Record<string, string>
): Promise<{ id: string } | null> {
  const value = email.toLowerCase().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = encodeURIComponent(`LOWER({email})="${value}"`);
  const url = `${AIRTABLE_BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_USERS)}?filterByFormula=${formula}&maxRecords=1`;
  const response = await fetch(url, { headers });
  if (!response.ok) return null;
  const data = await response.json();
  const record = data.records?.[0];
  return record ? { id: record.id } : null;
}

async function createAirtableUser(
  email: string,
  role: string,
  supabaseUserId: string,
  headers: Record<string, string>
): Promise<void> {
  const url = `${AIRTABLE_BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_USERS)}`;
  const body = {
    fields: {
      email: email.toLowerCase(),
      role: role.toLowerCase(),
      supabase_uid: supabaseUserId,
      created_at: new Date().toISOString().split('T')[0],
    },
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Airtable create: ${JSON.stringify(err)}`);
  }
}

async function updateAirtableUser(
  recordId: string,
  role: string,
  supabaseUserId: string,
  headers: Record<string, string>
): Promise<void> {
  const url = `${AIRTABLE_BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_USERS)}/${recordId}`;
  const body = {
    fields: {
      role: role.toLowerCase(),
      supabase_uid: supabaseUserId,
    },
  };
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Airtable update: ${JSON.stringify(err)}`);
  }
}

async function main() {
  console.log('Seeding users to Supabase and Airtable\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env.local');
    process.exit(1);
  }

  const airtableHeaders = {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  for (const u of SEED_USERS) {
    const email = u.email.trim().toLowerCase();
    const role = u.role?.toLowerCase();

    if (!email) {
      console.warn('Skipping: empty email');
      continue;
    }
    if (!role || !validRole(role)) {
      console.warn(`Skipping ${email}: role must be admin, reviewer, or submitter`);
      continue;
    }

    const password = u.password ?? DEFAULT_PASSWORD;
    const password_hash = await bcrypt.hash(password, 12);

    try {
      const { data: existingSupabase } = await supabase
        .from('users')
        .select('id, role')
        .eq('email', email)
        .single();

      let supabaseUserId: string;

      if (existingSupabase) {
        await supabase
          .from('users')
          .update({
            role,
            ...(u.password !== undefined ? { password_hash } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSupabase.id);
        supabaseUserId = existingSupabase.id;
        console.log(`Supabase: updated ${email} (${role})`);
      } else {
        const { data: inserted, error } = await supabase
          .from('users')
          .insert({ email, password_hash, role })
          .select('id')
          .single();
        if (error) throw new Error(`Supabase: ${error.message}`);
        supabaseUserId = inserted.id;
        console.log(`Supabase: created ${email} (${role})`);
      }

      const existingAirtable = await findAirtableUserByEmail(email, airtableHeaders);
      if (existingAirtable) {
        await updateAirtableUser(existingAirtable.id, role, supabaseUserId, airtableHeaders);
        console.log(`Airtable:  updated ${email}`);
      } else {
        await createAirtableUser(email, role, supabaseUserId, airtableHeaders);
        console.log(`Airtable:  created ${email}`);
      }

      console.log('');
    } catch (err) {
      console.error(`${email}: ${err instanceof Error ? err.message : err}\n`);
    }
  }

  console.log('Done. Users are in sync in Supabase and Airtable.');
  console.log('Default password for new logins: set SEED_DEFAULT_PASSWORD in .env.local or edit SEED_USERS in the script.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
