# Supabase Setup

## Seeding Users in Both Supabase and Airtable

To create the same users in **both** Supabase and Airtable in one go:

1. Edit `scripts/seed-users-both.ts`: set the `SEED_USERS` array (email, role, optional password).
2. Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`. Optional: `SEED_DEFAULT_PASSWORD` (default: `ChangeMe123!`).
3. Run:
   ```bash
   npm run seed:users-both
   ```
   Or: `npx tsx scripts/seed-users-both.ts`

4. Each user is created/updated in Supabase (for login) and in Airtable (with the same email, role, and Supabase user id). New users get the default password unless you set `password` in `SEED_USERS`.

**Airtable Users table** should have fields: `email`, `role`, `supabase_uid`, `created_at` (names must match).

---

## Syncing Users from Airtable to Supabase

To seed Supabase so users can log in using the same list as Airtable (one-way, Airtable as source):

1. Ensure `.env.local` has:
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`
   - Optional: `SEED_DEFAULT_PASSWORD` (default: `ChangeMe123!`)

2. Run:
   ```bash
   npm run seed:supabase-from-airtable
   ```
   Or: `npx tsx scripts/seed-supabase-from-airtable.ts`

3. The script:
   - Fetches all users from the Airtable Users table
   - Creates missing users in Supabase with the same email and role (and default password)
   - Updates existing users’ role to match Airtable (password unchanged)

4. New users get the default password; tell them to change it after first login.

---

## Creating the Users Table

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the contents of `supabase/migrations/001_create_users_table.sql`
5. Replace the UID in the INSERT statement with your actual Supabase user UID
6. Click **Run** to execute the migration

## Adding Your Admin User

After creating the table, run this SQL (replace with your actual UID):

```sql
INSERT INTO public.users (supabase_uid, email, role)
VALUES ('7c2a16dc-5877-4533-9d0b-ea02708a523a', 'tayawaaean@gmail.com', 'admin')
ON CONFLICT (supabase_uid) DO UPDATE SET role = 'admin';
```

## Alternative: Use Supabase Dashboard

1. Go to **Table Editor** in Supabase Dashboard
2. Click **New Table**
3. Name it `users`
4. Add these columns:
   - `id` (uuid, primary key, default: `gen_random_uuid()`)
   - `supabase_uid` (uuid, unique, references `auth.users(id)`)
   - `email` (text)
   - `role` (text, check constraint: `role IN ('admin', 'reviewer', 'submitter')`)
   - `created_at` (timestamptz, default: `now()`)
   - `updated_at` (timestamptz, default: `now()`)
5. Enable Row Level Security
6. Add the policies as shown in the migration file
