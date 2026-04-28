-- Phase 10: SECURITY DEFINER function for slug-availability check from /api/check-slug.
-- Returns true if a non-soft-deleted account has this slug.
--
-- Why SECURITY DEFINER: the wizard user's RLS SELECT policy on `accounts` only
-- allows reading their OWN row (WHERE owner_user_id = auth.uid()). A direct
-- SELECT WHERE slug = p_slug would return no rows for other tenants — giving a
-- false "available" for slugs already taken by others. This function runs as the
-- definer (postgres role) and can see all non-deleted rows, providing an accurate
-- existence check without exposing any account data.

create or replace function public.slug_is_taken(p_slug text)
  returns boolean
  language sql
  security definer
  set search_path = public
  stable
as $$
  select exists(
    select 1 from accounts
    where slug = p_slug
      and deleted_at is null
  );
$$;

-- Allow authenticated users to call it (anon does not need this;
-- slug check only happens for authed users in the onboarding wizard).
grant execute on function public.slug_is_taken(text) to authenticated;
