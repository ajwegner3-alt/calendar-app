-- Phase 12.5: per-account chrome tint intensity
-- Enum: 'none' (no tint, gray-50 chrome), 'subtle' (light tint), 'full' (heavy tint)
-- DEFAULT 'subtle' so existing accounts don't visually change abruptly post-deploy.

CREATE TYPE chrome_tint_intensity AS ENUM ('none', 'subtle', 'full');

ALTER TABLE accounts
  ADD COLUMN chrome_tint_intensity chrome_tint_intensity NOT NULL DEFAULT 'subtle';
