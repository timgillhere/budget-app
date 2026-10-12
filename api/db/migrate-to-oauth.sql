-- One-time upgrade from password + MFA sign-in to Google sign-in.
-- Run once against your Neon Postgres database, AFTER deploying the Google sign-in code.
-- Existing users keep their IDs (and so their budget data); they're linked to their Google
-- account by email the first time they sign in.

BEGIN;

-- Users: add the Google account link, drop the password.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
UPDATE users SET email = LOWER(TRIM(email));

-- Sessions: opaque hashed tokens replace JWTs. Old sessions can't be used, so sign everyone out.
DELETE FROM sessions;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash TEXT NOT NULL UNIQUE;

-- Password reset, in-app MFA, login rate limiting and bank-sync tokens are gone.
-- This permanently deletes stored authenticator secrets, backup codes and security answers.
DROP TABLE IF EXISTS security_questions;
DROP TABLE IF EXISTS backup_codes;
DROP TABLE IF EXISTS totp_credentials;
DROP TABLE IF EXISTS rate_limit_login;
DROP TABLE IF EXISTS api_tokens;

COMMIT;
