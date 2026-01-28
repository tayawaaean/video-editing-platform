-- Ensure password_hash column exists on users (e.g. if table was created without it)
-- Safe to run even if 001 was applied; column already exists then

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.users ADD COLUMN password_hash TEXT;
    COMMENT ON COLUMN public.users.password_hash IS 'bcrypt hash for NextAuth credentials';
  END IF;
END $$;
