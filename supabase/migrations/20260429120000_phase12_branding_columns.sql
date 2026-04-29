-- Phase 12: per-account background_color + background_shade tokens
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS background_color text
    CHECK (background_color IS NULL OR background_color ~* '^#[0-9a-f]{6}$');

DO $$ BEGIN
  CREATE TYPE background_shade AS ENUM ('none', 'subtle', 'bold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS background_shade background_shade NOT NULL DEFAULT 'subtle';

COMMENT ON COLUMN accounts.background_color IS
  'Phase 12: per-account hex tint for gradient backdrops. NULL = falls back to gray-50.';
COMMENT ON COLUMN accounts.background_shade IS
  'Phase 12: gradient intensity. none=flat tint of background_color (4% over white); subtle=light circles; bold=full Cruip pattern.';
