-- Make supabase_uid nullable for NextAuth-only users (no Supabase Auth)
-- Safe to run; only alters the column if it exists.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'supabase_uid'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN supabase_uid DROP NOT NULL;
  END IF;
END $$;
