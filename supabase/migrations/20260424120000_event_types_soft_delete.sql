-- Phase 3: Event Types CRUD — soft-delete column + partial unique index
--
-- Adds deleted_at to event_types and replaces the table's unique(account_id, slug)
-- constraint with a partial unique index that only enforces uniqueness among
-- NON-DELETED rows. Without the partial index, archiving an event type would
-- permanently block its slug from being reused — which breaks both:
--   (a) creating a new event type with the same name as an archived one
--   (b) restoring an archived event type when a new one has taken its slug
--       (the restore action would fail with a unique-violation 23505)
--
-- Idempotent: safe to re-run.

alter table event_types
  add column if not exists deleted_at timestamptz;

-- Drop the table-level unique constraint (covers ALL rows including archived).
-- Postgres auto-named it event_types_account_id_slug_key when the original
-- `unique(account_id, slug)` clause was declared inline in the CREATE TABLE.
alter table event_types
  drop constraint if exists event_types_account_id_slug_key;

-- Replace with a partial unique index — only non-deleted rows participate.
-- This is the load-bearing change for the restore UX.
create unique index if not exists event_types_account_id_slug_active
  on event_types(account_id, slug)
  where deleted_at is null;
