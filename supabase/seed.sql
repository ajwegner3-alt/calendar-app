-- Idempotent seed for Andrew's account.
-- The auth.users row must exist first — create manually via Supabase dashboard
-- (Authentication → Users → Add user) and paste the resulting UUID here,
-- OR leave owner_user_id null for now (Phase 2 auth will link it).

-- Approach A: seed with null owner_user_id, link later in Phase 2.
insert into accounts (slug, name, owner_user_id, timezone, brand_primary, brand_accent)
values ('nsi', 'North Star Integrations', null, 'America/Chicago', '#0A2540', '#F97316')
on conflict (slug) do nothing;
