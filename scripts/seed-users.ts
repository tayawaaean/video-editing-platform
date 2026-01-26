// Seed script for creating test users in Airtable
// Run with: npx tsx scripts/seed-users.ts

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_USERS = process.env.AIRTABLE_TABLE_USERS || 'Users';

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

// ============================================================
// CONFIGURE THESE WITH YOUR SUPABASE USER UIDs
// Create users in Supabase Dashboard → Authentication → Users
// Then copy their UUIDs here
// ============================================================
const TEST_USERS = [
  {
    supabase_uid: 'REPLACE_WITH_ADMIN_UID',      // Create user: admin@example.com
    email: 'admin@example.com',
    role: 'admin',
  },
  {
    supabase_uid: 'REPLACE_WITH_REVIEWER_UID',   // Create user: reviewer@example.com
    email: 'reviewer@example.com',
    role: 'reviewer',
  },
  {
    supabase_uid: 'REPLACE_WITH_SUBMITTER_UID',  // Create user: submitter@example.com
    email: 'submitter@example.com',
    role: 'submitter',
  },
];

async function createUser(user: typeof TEST_USERS[0]) {
  const response = await fetch(`${BASE_URL}/${AIRTABLE_TABLE_USERS}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        supabase_uid: user.supabase_uid,
        email: user.email,
        role: user.role,
        created_at: new Date().toISOString().split('T')[0],
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create ${user.email}: ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function main() {
  console.log('🌱 Seeding users to Airtable...\n');

  if (!AIRTABLE_API_KEY || AIRTABLE_API_KEY.includes('xxxx')) {
    console.error('❌ Error: AIRTABLE_API_KEY not configured in .env.local');
    process.exit(1);
  }

  if (!AIRTABLE_BASE_ID || AIRTABLE_BASE_ID.includes('XXXX')) {
    console.error('❌ Error: AIRTABLE_BASE_ID not configured in .env.local');
    process.exit(1);
  }

  const hasPlaceholders = TEST_USERS.some(u => u.supabase_uid.includes('REPLACE'));
  if (hasPlaceholders) {
    console.error('❌ Error: Please update TEST_USERS with actual Supabase UIDs');
    console.error('\nSteps:');
    console.error('1. Go to Supabase Dashboard → Authentication → Users');
    console.error('2. Click "Add user" and create users with passwords:');
    console.error('   - admin@example.com');
    console.error('   - reviewer@example.com');
    console.error('   - submitter@example.com');
    console.error('3. Copy each user\'s UUID and paste into scripts/seed-users.ts');
    console.error('4. Run this script again\n');
    process.exit(1);
  }

  for (const user of TEST_USERS) {
    try {
      await createUser(user);
      console.log(`✅ Created ${user.role}: ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed: ${error}`);
    }
  }

  console.log('\n✨ Seeding complete!');
  console.log('\nYou can now log in with:');
  console.log('  Admin:     admin@example.com');
  console.log('  Reviewer:  reviewer@example.com');
  console.log('  Submitter: submitter@example.com');
}

main();
