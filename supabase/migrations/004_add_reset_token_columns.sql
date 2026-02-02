-- Add password reset token columns to users table
-- These columns store the reset token and its expiry time

-- Add reset_token column (stores the hashed token)
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;

-- Add reset_token_expires column (when the token expires)
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;

-- Create index on reset_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
