// Seed script for creating users in Supabase users table
// Run with: npx tsx scripts/seed-supabase-users.ts

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ============================================================
// CONFIGURE THESE WITH YOUR SUPABASE USER UIDs
// Create users in Supabase Dashboard → Authentication → Users
// Then copy their UUIDs here
// ============================================================
const TEST_USERS = [
  {
    supabase_uid: '7c2a16dc-5877-4533-9d0b-ea02708a523a',
    email: 'tayawaaean@gmail.com',
    role: 'admin',
  },
];

async function main() {
  console.log('Seeding users to Supabase...\n');

  if (!SUPABASE_URL) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL not configured in .env.local');
    process.exit(1);
  }

  if (!SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY not configured in .env.local');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  for (const user of TEST_USERS) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, supabase_uid, email, role')
        .eq('supabase_uid', user.supabase_uid)
        .single();

      if (existingUser) {
        console.log(`User already exists: ${user.email} (${user.role})`);
        continue;
      }

      // Insert user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          supabase_uid: user.supabase_uid,
          email: user.email,
          role: user.role,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create ${user.email}: ${error.message}`);
      }

      console.log(`Created ${user.role}: ${user.email}`);
    } catch (error) {
      console.error(`Failed: ${error}`);
    }
  }

  console.log('\nSeeding complete!');
  console.log('\nYou can now log in with:');
  console.log('  Admin:     tayawaaean@gmail.com');
}

main();
