-- Phase 12.6: Add sidebar_color per-account column.
-- ADDITIVE ONLY — do NOT drop chrome_tint_intensity or background_shade.
-- background_color column keeps its name; it serves as the "page color" field
-- semantically (no rename — rename is risky on prod with existing data).
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS sidebar_color text
    CHECK (sidebar_color IS NULL OR sidebar_color ~* '^#[0-9a-f]{6}$');

COMMENT ON COLUMN accounts.sidebar_color IS
  'Per-account sidebar background color. Null = shadcn default (--sidebar token). Phase 12.6.';
