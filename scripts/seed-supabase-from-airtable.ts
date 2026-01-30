/**
 * Seed Supabase users table from Airtable Users.
 * Fetches all users from Airtable and creates/updates them in Supabase so they can log in.
 *
 * Run: npx tsx scripts/seed-supabase-from-airtable.ts
 *
 * New users get a default password (set SEED_DEFAULT_PASSWORD in .env.local or use ChangeMe123!).
 * Existing users by email get their role updated to match Airtable; password is left unchanged.
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

async function fetchAirtableUsers(): Promise<{ id: string; fields: Record<string, unknown> }[]> {
  const url = `${AIRTABLE_BASE_URL}/${encodeURIComponent(AIRTABLE_TABLE_USERS)}?sort%5B0%5D%5Bfield%5D=created_at&sort%5B0%5D%5Bdirection%5D=desc`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Airtable: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.records ?? [];
}

/** Airtable returns field names exactly as in the base (e.g. "Email" or "email"). */
function getField(fields: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const v = fields[name];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

async function main() {
  console.log('Syncing users: Airtable -> Supabase\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env.local');
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const records = await fetchAirtableUsers();
  console.log(`Fetched ${records.length} user(s) from Airtable (base: ${AIRTABLE_BASE_ID}, table: ${AIRTABLE_TABLE_USERS}).\n`);

  if (records.length === 0) {
    console.log('No records to sync. Add users in Airtable or check:');
    console.log('  - AIRTABLE_BASE_ID matches your base (from the base URL)');
    console.log('  - AIRTABLE_TABLE_USERS matches the table name (default: Users)');
    return;
  }

  const validRole = (r: string): r is 'admin' | 'reviewer' | 'submitter' =>
    ['admin', 'reviewer', 'submitter'].includes(r);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    const fields = record.fields as Record<string, unknown>;
    const email = getField(fields, 'email', 'Email')?.toLowerCase();
    const role = getField(fields, 'role', 'Role')?.toLowerCase();

    if (!email) {
      console.warn(`Skipping Airtable record ${record.id}: no email`);
      skipped++;
      continue;
    }

    if (!role || !validRole(role)) {
      console.warn(`Skipping ${email}: invalid or missing role (use admin, reviewer, submitter)`);
      skipped++;
      continue;
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .single();

    if (existing) {
      if (existing.role === role) {
        console.log(`Unchanged: ${email} (${role})`);
        continue;
      }
      const { error } = await supabase
        .from('users')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) {
        console.error(`Update failed ${email}: ${error.message}`);
        continue;
      }
      console.log(`Updated: ${email} -> ${role}`);
      updated++;
    } else {
      const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
      const { error } = await supabase.from('users').insert({
        email,
        password_hash,
        role,
      });
      if (error) {
        console.error(`Create failed ${email}: ${error.message}`);
        continue;
      }
      console.log(`Created: ${email} (${role}) - default password`);
      created++;
    }
  }

  console.log('\nDone.');
  console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

  if (records.length > 0 && created === 0 && updated === 0 && skipped === records.length) {
    const first = records[0].fields as Record<string, unknown>;
    console.log('\nAll records skipped. First record field names:', Object.keys(first).join(', '));
    console.log('Airtable field names must be "email" (or "Email") and "role" (or "Role").');
  }

  if (created > 0) {
    console.log('\nNew users have default password. Set SEED_DEFAULT_PASSWORD in .env.local to override.');
    console.log('Tell users to change password after first login.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
