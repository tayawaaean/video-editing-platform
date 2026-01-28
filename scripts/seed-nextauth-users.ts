/**
 * Seed script for NextAuth users table in Supabase and Airtable Users
 *
 * Run with: npx tsx scripts/seed-nextauth-users.ts
 *
 * Creates/updates users in Supabase (login) and syncs to Airtable Users (same email, role, supabase_uid = Supabase user id).
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID!;
const airtableTableUsers = process.env.AIRTABLE_TABLE_USERS || 'Users';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function airtableBaseUrl(): string {
  return `https://api.airtable.com/v0/${airtableBaseId}`;
}

function airtableHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${airtableApiKey}`,
    'Content-Type': 'application/json',
  };
}

async function airtableGetUserBySupabaseUid(supabaseUid: string): Promise<{ id: string } | null> {
  if (!airtableApiKey || !airtableBaseId) return null;
  const formula = encodeURIComponent(`{supabase_uid}="${supabaseUid}"`);
  const url = `${airtableBaseUrl()}/${airtableTableUsers}?filterByFormula=${formula}&maxRecords=1`;
  const res = await fetch(url, { method: 'GET', headers: airtableHeaders() });
  if (!res.ok) return null;
  const data = (await res.json()) as { records: { id: string }[] };
  return data.records?.[0] ?? null;
}

async function airtableCreateUser(supabaseUid: string, email: string, role: string): Promise<boolean> {
  if (!airtableApiKey || !airtableBaseId) return false;
  const url = `${airtableBaseUrl()}/${airtableTableUsers}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: airtableHeaders(),
    body: JSON.stringify({
      fields: {
        supabase_uid: supabaseUid,
        email: email.toLowerCase(),
        role,
        created_at: new Date().toISOString().split('T')[0],
      },
    }),
  });
  return res.ok;
}

async function airtableUpdateRole(recordId: string, role: string): Promise<boolean> {
  if (!airtableApiKey || !airtableBaseId) return false;
  const url = `${airtableBaseUrl()}/${airtableTableUsers}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: airtableHeaders(),
    body: JSON.stringify({ fields: { role } }),
  });
  return res.ok;
}

async function syncUserToAirtable(supabaseUserId: string, email: string, role: string): Promise<void> {
  if (!airtableApiKey || !airtableBaseId) {
    console.log('  (Airtable env not set, skipping Airtable sync)');
    return;
  }
  const existing = await airtableGetUserBySupabaseUid(supabaseUserId);
  if (existing) {
    const ok = await airtableUpdateRole(existing.id, role);
    if (ok) console.log('  Airtable: role updated');
    else console.warn('  Airtable: failed to update role');
  } else {
    const ok = await airtableCreateUser(supabaseUserId, email, role);
    if (ok) console.log('  Airtable: created');
    else console.warn('  Airtable: failed to create');
  }
}

interface SeedUser {
  email: string;
  password: string;
  role: 'admin' | 'reviewer' | 'submitter';
}

// Define seed users - change passwords as needed
const seedUsers: SeedUser[] = [
  { email: 'admin@example.com', password: '123password', role: 'admin' },
  { email: 'reviewer@example.com', password: '123password', role: 'reviewer' },
  { email: 'submitter@example.com', password: '123password', role: 'submitter' },
  // Add your actual users here:
  { email: 'tayawaaean@gmail.com', password: '123password', role: 'admin' },
  { email: 'aean@crucible.fund', password: '123password', role: 'submitter' },
  { email: 'yortago@gmail.com', password: '123password', role: 'reviewer' },
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function seedUsers_() {
  console.log('Seeding users...\n');

  for (const user of seedUsers) {
    try {
      // Hash the password
      const passwordHash = await hashPassword(user.password);

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', user.email.toLowerCase())
        .single();

      if (existingUser) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            password_hash: passwordHash,
            role: user.role,
          })
          .eq('email', user.email.toLowerCase());

        if (updateError) {
          console.error(`Error updating ${user.email}:`, updateError.message);
        } else {
          console.log(`Updated: ${user.email} (${user.role})`);
          await syncUserToAirtable(existingUser.id, user.email, user.role);
        }
      } else {
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            email: user.email.toLowerCase(),
            password_hash: passwordHash,
            role: user.role,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`Error creating ${user.email}:`, insertError.message);
        } else if (newUser) {
          console.log(`Created: ${user.email} (${user.role})`);
          await syncUserToAirtable(newUser.id, user.email, user.role);
        }
      }
    } catch (error) {
      console.error(`Error processing ${user.email}:`, error);
    }
  }

  console.log('\nSeeding complete!');
  console.log('\nTest credentials:');
  seedUsers.forEach(u => {
    console.log(`  ${u.email} / ${u.password} (${u.role})`);
  });
}

seedUsers_().catch(console.error);
