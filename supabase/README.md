# Supabase Setup

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
