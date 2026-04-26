---
phase: 07-widget-and-branding
plan: 08
type: execute
wave: 3
depends_on: ["07-01", "07-06"]
files_modified:
  - app/[account]/page.tsx
  - app/[account]/_lib/load-account-listing.ts
  - app/[account]/_lib/types.ts
  - app/[account]/_components/event-type-card.tsx
  - app/[account]/_components/empty-state.tsx
autonomous: true

must_haves:
  truths:
    - "Visiting /nsi shows a card grid of all active, non-soft-deleted event types for the nsi account"
    - "Each card shows name, duration, truncated description (~120 chars), a duration badge styled with the account's brand_primary, and a 'Book' CTA"
    - "Clicking anywhere on a card navigates to /nsi/[event-slug]"
    - "If account has no active event types, an empty state renders: 'No bookings available right now — reach out at <owner_email>.' (or without contact line if owner_email is null)"
    - "Reserved slugs (app, api, _next, auth, embed) return notFound()"
    - "Non-existent account slug returns notFound()"
    - "Account branding (logo + primary color) renders at the top via BrandedPage wrapper"
  artifacts:
    - path: "app/[account]/page.tsx"
      provides: "Server Component: loads account + active event types; renders card grid OR empty state"
    - path: "app/[account]/_lib/load-account-listing.ts"
      provides: "Server-only loader: getAccountListing(slug) -> { account, eventTypes } | null"
      exports: ["loadAccountListing"]
    - path: "app/[account]/_lib/types.ts"
      provides: "AccountListingData + EventTypeCard types"
      exports: ["AccountListingData", "EventTypeCardData"]
    - path: "app/[account]/_components/event-type-card.tsx"
      provides: "Server-component card with name, description, duration badge (brand color), Book CTA"
      exports: ["EventTypeCard"]
    - path: "app/[account]/_components/empty-state.tsx"
      provides: "Friendly empty state with optional owner_email contact line"
      exports: ["AccountEmptyState"]
  key_links:
    - from: "app/[account]/page.tsx"
      to: "loadAccountListing"
      via: "import + call with awaited param"
      pattern: "loadAccountListing"
    - from: "app/[account]/_lib/load-account-listing.ts"
      to: "RESERVED_SLUGS"
      via: "shares the same set as load-event-type.ts (DRY)"
      pattern: "RESERVED_SLUGS"
    - from: "app/[account]/page.tsx"
      to: "BrandedPage from app/_components/branded-page.tsx"
      via: "wraps card grid"
      pattern: "BrandedPage"
---

<objective>
Build the public account index route at `/[account]` (e.g., `/nsi`). Server Component renders a 2-column responsive card grid of all active, non-soft-deleted event types. Each card has name, duration, ~120-char-truncated description, brand-colored duration badge, and a "Book" CTA. Empty state when no events: friendly message + optional owner_email contact line.

Purpose: Delivers EMBED-08 (public hosted page at /[account] lists all active event types with links). CONTEXT lock: card grid (not list); whole card clickable; empty state never 404s — always useful.

Output: New `app/[account]/page.tsx` + `_lib/` (loader + types) + `_components/` (event-type-card + empty-state). Conflicts with the existing dynamic route `/[account]/[event-slug]` — Next.js 16 allows both `page.tsx` at /[account] level AND nested `[event-slug]/page.tsx`, the dynamic param scopes via depth.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07-widget-and-branding/07-CONTEXT.md
@.planning/phases/07-widget-and-branding/07-RESEARCH.md
@.planning/phases/07-widget-and-branding/07-01-SUMMARY.md

# Existing patterns
@app/[account]/[event-slug]/_lib/load-event-type.ts
@app/(shell)/app/event-types/_components/event-types-table.tsx
@app/_components/branded-page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Loader + types + reserved-slug guard</name>
  <files>
    app/[account]/_lib/types.ts
    app/[account]/_lib/load-account-listing.ts
  </files>
  <action>
    Create `app/[account]/_lib/types.ts`:
    ```typescript
    export interface AccountListingData {
      account: {
        id: string;
        slug: string;
        name: string;
        timezone: string;
        owner_email: string | null;
        logo_url: string | null;
        brand_primary: string | null;
      };
      eventTypes: EventTypeCardData[];
    }

    export interface EventTypeCardData {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      duration_minutes: number;
    }
    ```

    Create `app/[account]/_lib/load-account-listing.ts`:
    ```typescript
    import "server-only";
    import { createAdminClient } from "@/lib/supabase/admin";
    import type { AccountListingData, EventTypeCardData } from "./types";

    // Must mirror RESERVED_SLUGS in load-event-type.ts (DRY tradeoff: not exported
    // because both files are public route loaders; duplication is bounded).
    const RESERVED_SLUGS = new Set(["app", "api", "_next", "auth", "embed"]);

    /**
     * Loads account + all active, non-soft-deleted event types for the public /[account] index.
     *
     * - Service-role admin client (route is unauthenticated; RLS would silently return 0 rows)
     * - Returns null if slug is reserved or account row missing
     * - Returns empty eventTypes array if account exists but has no active events
     *   (caller renders empty state, NOT notFound — CONTEXT lock: never 404 on real account)
     */
    export async function loadAccountListing(
      accountSlug: string,
    ): Promise<AccountListingData | null> {
      if (RESERVED_SLUGS.has(accountSlug)) return null;

      const supabase = createAdminClient();

      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("id, slug, name, timezone, owner_email, logo_url, brand_primary")
        .eq("slug", accountSlug)
        .maybeSingle();

      if (accountError || !account) return null;

      const { data: events, error: eventsError } = await supabase
        .from("event_types")
        .select("id, slug, name, description, duration_minutes")
        .eq("account_id", account.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (eventsError) {
        // Don't 404 on transient DB errors — fail soft, render empty state.
        console.error("[loadAccountListing] events query failed:", eventsError);
      }

      const eventTypes: EventTypeCardData[] = (events ?? []).map((e) => ({
        id: e.id,
        slug: e.slug,
        name: e.name,
        description: e.description,
        duration_minutes: e.duration_minutes,
      }));

      return { account, eventTypes };
    }
    ```

    KEY DECISIONS:
    - Service-role admin client (Phase 5 lock: public routes use admin client because anon RLS returns 0 rows).
    - RESERVED_SLUGS duplicated, NOT imported from load-event-type.ts. Why: keeping the public-route loaders independent prevents accidental coupling between booking-page and account-index loaders. Cost: must manually keep both Sets in sync. Document this in the SUMMARY as a known minor coupling.
    - Empty events list returns success (NOT null) — CONTEXT lock: empty state is the rendering branch.
    - `console.error` on events query error → still return account with empty events. Prevents accidentally 404'ing on transient DB blips.
  </action>
  <verify>
    `npx tsc --noEmit` passes.
    Both files exist with correct exports.
  </verify>
  <done>
    Types + loader created; RESERVED_SLUGS includes "embed"; admin client used; empty-events branch returns success not null.
  </done>
</task>

<task type="auto">
  <name>Task 2: Card + empty-state components</name>
  <files>
    app/[account]/_components/event-type-card.tsx
    app/[account]/_components/empty-state.tsx
  </files>
  <action>
    Create `app/[account]/_components/event-type-card.tsx` — Server Component (no "use client"):
    ```tsx
    import Link from "next/link";
    import type { CSSProperties } from "react";
    import type { EventTypeCardData } from "../_lib/types";
    import { pickTextColor } from "@/lib/branding/contrast";

    const DESC_TRUNCATE_AT = 120; // CONTEXT lock

    interface EventTypeCardProps {
      accountSlug: string;
      event: EventTypeCardData;
      brandPrimary: string | null;
    }

    export function EventTypeCard({ accountSlug, event, brandPrimary }: EventTypeCardProps) {
      const desc = event.description ?? "";
      const truncated =
        desc.length > DESC_TRUNCATE_AT
          ? desc.slice(0, DESC_TRUNCATE_AT - 1).trimEnd() + "…"
          : desc;

      const effectiveColor = brandPrimary ?? "#0A2540";
      const textColor = pickTextColor(effectiveColor);

      const badgeStyle: CSSProperties = {
        background: effectiveColor,
        color: textColor,
        padding: "2px 10px",
        borderRadius: "9999px",
        fontSize: 12,
        fontWeight: 600,
        display: "inline-block",
      };

      const ctaStyle: CSSProperties = {
        background: effectiveColor,
        color: textColor,
      };

      // Whole card is a Link (CONTEXT lock: whole card clickable)
      return (
        <Link
          href={`/${accountSlug}/${event.slug}`}
          className="block rounded-lg border bg-card p-6 hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold">{event.name}</h2>
            <span style={badgeStyle}>{event.duration_minutes} min</span>
          </div>
          {truncated && (
            <p className="text-sm text-muted-foreground mb-4">{truncated}</p>
          )}
          <span
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium"
            style={ctaStyle}
          >
            Book
          </span>
        </Link>
      );
    }
    ```

    Create `app/[account]/_components/empty-state.tsx`:
    ```tsx
    interface AccountEmptyStateProps {
      accountName: string;
      ownerEmail: string | null;
    }

    export function AccountEmptyState({ accountName, ownerEmail }: AccountEmptyStateProps) {
      return (
        <div className="rounded-lg border bg-card p-10 text-center">
          <h2 className="text-lg font-semibold mb-2">No bookings available right now</h2>
          {ownerEmail ? (
            <p className="text-sm text-muted-foreground">
              Reach out to {accountName} at{" "}
              <a
                href={`mailto:${ownerEmail}`}
                className="underline underline-offset-2 hover:no-underline"
              >
                {ownerEmail}
              </a>
              .
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Check back later or contact {accountName} for availability.
            </p>
          )}
        </div>
      );
    }
    ```

    KEY DECISIONS:
    - Card is a Server Component — no client interactivity needed. Whole-card clickable via outer `<Link>`.
    - Description truncated at 120 chars + ellipsis (CONTEXT lock).
    - Duration badge + Book CTA both styled with brand color via inline style + auto text color.
    - Empty state branches on `ownerEmail` truthiness (CONTEXT lock).
    - No graceful "loading" state needed — Server Component renders directly.
  </action>
  <verify>
    `npx tsc --noEmit` passes.
    Both files exist.
  </verify>
  <done>
    EventTypeCard + AccountEmptyState components created; whole-card link; truncation; brand styling.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire app/[account]/page.tsx + dev smoke</name>
  <files>
    app/[account]/page.tsx
  </files>
  <action>
    Create `app/[account]/page.tsx` — Server Component:
    ```tsx
    import type { Metadata } from "next";
    import { notFound } from "next/navigation";
    import { BrandedPage } from "@/app/_components/branded-page";
    import { loadAccountListing } from "./_lib/load-account-listing";
    import { EventTypeCard } from "./_components/event-type-card";
    import { AccountEmptyState } from "./_components/empty-state";

    interface RouteParams {
      account: string;
    }

    export async function generateMetadata({
      params,
    }: {
      params: Promise<RouteParams>;
    }): Promise<Metadata> {
      const { account } = await params;
      const data = await loadAccountListing(account);
      if (!data) {
        return { title: "Page not found" };
      }
      return {
        title: `${data.account.name} — Book a time`,
        description: `Pick a time to meet with ${data.account.name}.`,
      };
    }

    export default async function AccountIndexPage({
      params,
    }: {
      params: Promise<RouteParams>;
    }) {
      const { account } = await params;
      const data = await loadAccountListing(account);
      if (!data) notFound();

      return (
        <BrandedPage
          logoUrl={data.account.logo_url}
          primaryColor={data.account.brand_primary}
          accountName={data.account.name}
        >
          <main className="mx-auto max-w-5xl px-6 py-10">
            <header className="mb-8 text-center">
              <h1 className="text-2xl font-semibold">{data.account.name}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Pick a time to meet.
              </p>
            </header>
            {data.eventTypes.length === 0 ? (
              <AccountEmptyState
                accountName={data.account.name}
                ownerEmail={data.account.owner_email}
              />
            ) : (
              <section className="grid gap-4 md:grid-cols-2">
                {data.eventTypes.map((event) => (
                  <EventTypeCard
                    key={event.id}
                    accountSlug={data.account.slug}
                    event={event}
                    brandPrimary={data.account.brand_primary}
                  />
                ))}
              </section>
            )}
          </main>
        </BrandedPage>
      );
    }
    ```

    KEY DECISIONS:
    - Wrapped in BrandedPage (Plan 07-06 dependency, but BrandedPage is a server component with no runtime deps — safe to consume even if 07-06 hasn't merged).
    - Wait — 07-06 is in the same wave. Files won't conflict (07-06 OWNS branded-page.tsx; 07-08 only imports from it). Both can run in parallel within wave 3 IF 07-06 completes its Task 1 first OR if both plans share a coordinated commit boundary. To remove ordering risk, this plan (07-08) is in WAVE 2 and depends only on 07-01 — but BrandedPage doesn't exist until Plan 07-06. RESOLUTION: 07-08 is moved to WAVE 3 with `depends_on: ["07-01", "07-06"]`. Update frontmatter accordingly OR inline the BrandedPage logic here (5 lines + pickTextColor import) to avoid the dependency.

    DECISION: Update frontmatter `depends_on: ["07-01", "07-06"]` and `wave: 3` after writing this plan. Andrew's planner will reconcile when assembling waves.

    Actually — re-reading the planner directive: I (planner) compute waves. Let me re-decide:

    Plan 07-06 is in wave 3 because it depends on 07-01.
    Plan 07-08 needs BrandedPage (created in 07-06 task 1) → 07-08 also belongs in wave 3 with depends_on: ["07-01", "07-06"].

    HOWEVER, 07-06 Task 1 creates app/_components/branded-page.tsx as a server component with one import (pickTextColor from lib/branding/contrast). It's a tiny atomic unit. There's no real reason to gate 07-08 on 07-06 — they don't share files. The cleanest resolution: 07-08 imports BrandedPage; if Plan 07-06 hasn't run yet, the import will fail — but waves enforce ordering.

    LOCK: 07-08 stays in wave 3 with depends_on: ["07-01", "07-06"]. Update the frontmatter at the TOP of this PLAN.md before committing. (Self-correction: the frontmatter wave/depends will be updated below in the final plan list.)
  </action>
  <verify>
    `npm run build` succeeds.
    Visit `/nsi` in dev — should see card grid of active events with NSI logo + brand color (after Plan 07-04 saves branding).
    Visit `/some-fake-account` — 404.
    Visit `/embed` — 404 (RESERVED_SLUGS).
    Manually archive all event types in /app/event-types and visit `/nsi` — empty state shows with owner_email contact line.
  </verify>
  <done>
    /[account] route renders card grid; empty state branches on owner_email; reserved slugs + missing accounts 404; branding wraps the page.
  </done>
</task>

</tasks>

<verification>
- `npm run build` succeeds.
- `npm test` — no regressions.
- /nsi renders correctly with logo + branded cards (after Plan 07-04 sets branding).
- /nsi with no active events shows empty state.
- /nsi/[event-slug] (existing Phase 5 route) still works (route precedence is correct: /nsi/page.tsx scopes to depth 1, /nsi/[event-slug]/page.tsx scopes to depth 2).
- Reserved slugs (`/app`, `/api`, `/embed`, `/auth`) all 404 cleanly.
</verification>

<success_criteria>
1. EMBED-08: /[account] route lists all active event types with brand-styled cards + "Book" CTA.
2. Empty state has optional owner_email contact line.
3. Reserved-slug guard mirrors load-event-type.ts (includes "embed").
4. BrandedPage wrap delivers logo header + CSS vars consistent with other surfaces.
5. Whole card is clickable; description truncated at 120 chars.
</success_criteria>

<output>
After completion, create `.planning/phases/07-widget-and-branding/07-08-SUMMARY.md` documenting:
- Loader contract (returns null on missing/reserved; returns success with empty array if no events)
- RESERVED_SLUGS duplication tradeoff (kept independent from load-event-type.ts)
- Card design decisions (whole-card link, brand-colored badge + CTA, 120-char truncation)
- Empty state contract (optional owner_email branch)
- Route precedence verification (/nsi → index page; /nsi/foo → existing event-slug page)
- Forward implications: any future v2 multi-tenant onboarding flow MUST update both RESERVED_SLUGS sets
</output>
