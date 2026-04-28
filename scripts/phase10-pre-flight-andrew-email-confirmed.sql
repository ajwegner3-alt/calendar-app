-- Phase 10 P-A8 pre-flight: ensure Andrew's auth user has email_confirmed_at set
-- BEFORE flipping the Supabase "Enable email confirmations" toggle.
--
-- If email_confirmed_at is NULL when the toggle is flipped, Andrew's account
-- will be treated as unverified and his next login will be blocked.
--
-- v1.0 created Andrew's account via auth.admin.createUser({ email_confirm: true }),
-- so email_confirmed_at SHOULD already be set. This script verifies that and
-- provides a conditional UPDATE if it is not.
--
-- Run via Supabase Studio SQL Editor, or:
--   npx supabase db query --linked -f scripts/phase10-pre-flight-andrew-email-confirmed.sql
--
-- Andrew's identifiers:
--   email:       ajwegner3@gmail.com
--   user_id:     1a8c687f-73fd-4085-934f-592891f51784
--   accounts.id: ba8e712d-28b7-4071-b3d4-361fb6fb7a60

-- ============================================================
-- Step A: SELECT — observe current state.
-- Expected: email_confirmed_at is NOT NULL.
-- ============================================================
select
  id,
  email,
  email_confirmed_at,
  created_at
from auth.users
where email = 'ajwegner3@gmail.com';

-- ============================================================
-- Step B (CONDITIONAL): if Step A returned NULL email_confirmed_at, run:
--
-- update auth.users
-- set email_confirmed_at = now()
-- where email = 'ajwegner3@gmail.com';
--
-- Commented out by default.
-- Uncomment ONLY if Step A showed email_confirmed_at IS NULL.
-- ============================================================

-- ============================================================
-- Step C: Re-SELECT to confirm non-null email_confirmed_at.
-- Run this after Step A (and Step B if triggered).
-- Expected: email_confirmed_at is NOT NULL.
-- ============================================================
select
  email,
  email_confirmed_at
from auth.users
where email = 'ajwegner3@gmail.com';
