# Feature Research — v1.1 Multi-User + Capacity + Branded UI

**Domain:** Multi-tenant Calendly-style booking SaaS (extending v1.0; opening to anyone)
**Researched:** 2026-04-27
**Confidence:** MEDIUM-HIGH (Calendly/Cal.com behavior HIGH; SavvyCal/Acuity specific UI flows MEDIUM; email gradient rendering HIGH)
**Mode:** Ecosystem (subsequent milestone — v1.0 stack + features already validated)

> Note on scope: this file covers ONLY v1.1's three new capability areas (multi-user signup/onboarding, per-event-type capacity, branded UI overhaul). v1.0 features (event types, availability, public booking, embed widget, reminders, RLS, rate limiting) are already validated and out of scope to re-research.

---

## A. Multi-User Signup + Account Onboarding

### Table Stakes (v1.1 must ship)

Features users assume exist after seeing Calendly/Cal.com. Missing them = signup feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Public `/signup` form (email + password) | Currently only Andrew can sign up; opening to anyone is the whole point of v1.1 | M | Mirror existing `/login` UX. `@supabase/ssr` already wired. Reuse `auth-helpers` shape from Phase 2. |
| Email verification before login | Calendly/Cal.com both gate first login behind email confirmation. Prevents typo'd email = orphan accounts | M | Supabase `emailRedirectTo` -> `/auth/callback`. **Hard dependency: `/auth/callback` 404 must be fixed first** (FUTURE_DIRECTIONS §1, line 45-46). |
| Working `/auth/callback` route | v1.0 ships this broken; signup AND password reset BOTH go through it | M | Single route handles signup-confirm `?type=signup`, recovery `?type=recovery`, magic-link `?type=magiclink`. Exchange code for session via `supabase.auth.exchangeCodeForSession()`. **Blocks all Phase 10 work.** |
| Slug picker with collision detection | Calendly/Cal.com both pick username at signup. Must be unique account-wide | M | `accounts.slug` is already UNIQUE in v1.0 schema. Add real-time `/api/check-slug` endpoint. Validate `/^[a-z0-9-]{3,40}$/`. Reject `RESERVED_SLUGS` (currently `["app", "api", "_next", "auth", "embed"]` — duplicated across 2 files per FUTURE_DIRECTIONS §2). |
| Auto-provision account on signup | Signup must create `accounts` row + link `owner_user_id` atomically. Otherwise user logs in to nothing | M | Postgres function or Server Action wrapping (1) Supabase Auth user create, (2) `accounts` insert with slug/timezone/owner_email/owner_user_id, (3) seed default availability + default event type. Wrap in transaction (RPC) — partial failure = orphan user. |
| Default Mon-Fri 9am-5pm availability in user's local TZ | Calendly + Cal.com + Acuity all do this. Confirmed via search. | S | Read browser TZ on signup form (`Intl.DateTimeFormat().resolvedOptions().timeZone`), pass to provisioning, insert 5 `availability_rules` rows (Mon-Fri, 09:00-17:00). |
| One default event type ("30 Minute Meeting") | Cal.com ships THREE defaults (15-min, 30-min, "Secret Meeting"); Calendly ships ONE; Andrew's ask is one. Validates "log in -> see something to share" loop | S | Insert single `event_types` row with `slug=30min`, `duration_minutes=30`, `max_bookings_per_slot=1` (Phase 11 default). Active by default. |
| Password reset flow | Same `/auth/callback` route; users need to be able to recover accounts | S | Supabase Auth `resetPasswordForEmail`. `/auth/reset-password` form posts new password. Trivial once `/auth/callback` works. |
| First-login wizard (3-4 steps max) | Long wizards bleed users; Calendly's is 4 steps (name -> username -> availability -> first event type). Confirmed via Formbricks/Chameleon onboarding research. | M | Steps: (1) display name + slug, (2) timezone confirm, (3) brand color picker (existing v1.0 surface), (4) "share your link" success screen. Skippable from step 2 onward — defaults are sane. |
| Account profile page (display name, email, password change) | Table-stakes SaaS — users hit "Settings" expecting these | M | New `/app/settings/profile` route. Email change via Supabase Auth (re-verifies). Password change via current-password challenge. Display name edit on `accounts.display_name` (new column). |
| Soft logout / session-end UX | Users expect a "log out" button that works | S | Already partially exists in v1.0 dashboard. Confirm visible in new sidebar IA. |

### Differentiators (capability-tier — scope decision required)

Features that improve onboarding feel but are not blocking. Andrew picks tier.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Slug suggestion-on-collision | If `andrew` is taken, suggest `andrew2`, `andrew-nsi`, `andrewhvac`. Reduces drop-off at the most-error-prone step | M | Calendly does this; Cal.com does this. Algorithm: append `-1`, `-2`, take first available. Or hash email-prefix variants. Skip = users get red error + retry. |
| "Soft confirm" with banner instead of hard email-verify gate | User can use the app immediately; banner reminds them to verify. Lower drop-off; risk = orphan-typo accounts persist | M | Calendly = soft confirm. Cal.com = hard gate. Trade-off: friction vs. junk accounts. **Recommendation: hard gate for v1.1** — fewer orphan rows in `accounts`/`auth.users`; simpler ops; we don't have signup volume to justify soft-confirm complexity. |
| Welcome email post-signup | Reinforces brand; sends "share your booking link" prompt | S | Reuse `lib/email-sender/`; new template in `lib/email/send-welcome.ts`. NOT the verification email — that's separate Supabase-Auth email. |
| Onboarding progress checklist on dashboard | Calendly shows "Set availability ✓ / Customize event ✓ / Share your link ☐". Nudges activation | M | UI-only; reads `accounts.brand_primary IS NULL`, count of bookings, etc. Persistable dismiss state. **Skip in v1.1** — wizard already covers activation; checklist is post-MVP nicety. |
| Magic-link login (passwordless) | Lower friction for return users | M | Supabase Auth supports it natively. Same `/auth/callback`. Adds OR not XOR with password. **Skip in v1.1** — defer to v1.2; password-only is fine. |
| Account deletion (self-serve) | GDPR/CCPA hygiene; users expect a "delete account" button | M | Cascade delete `accounts` -> `event_types` -> `availability_rules` -> `bookings` -> `auth.users`. RLS makes this safe. **Recommendation: SOFT-DELETE in v1.1** (`accounts.deleted_at` timestamp; hide from public; cron-purge in v1.2). Hard delete is risky pre-v1.2. |
| Email change with confirmation loop | User changes email -> email sent to BOTH old + new -> confirms via new | M | Supabase Auth handles this. Just need UI. **Defer to v1.2** unless free-tier multi-user signup creates demand. |

### Anti-features (commonly requested, NOT building in v1.1)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| OAuth (Google/GitHub) signup | "Lower friction" / "Calendly has it" | Adds OAuth provider config + token refresh + linked-account UX. Increases support surface. v1.1 is free tier; users not blocked by password forms | Email/password only in v1.1. Revisit when paid tiers exist (v1.3+). |
| Multi-user-per-account / team seats | "What if a contractor wants their assistant to manage bookings?" | Requires a `team_members` join table, role-permission model, RLS rewrites, invite emails. Massive scope. Out of scope per PROJECT.md ("Single-owner per account") | One account = one user in v1.1. v2 milestone for teams. |
| Stripe / paid tiers gating signup | "We need to monetize" | v1.1 explicitly free per PROJECT.md Key Decisions row. Stripe webhooks + plan enforcement + RLS-by-plan = its own milestone | Free for everyone in v1.1. Paid in later milestone. |
| 7+ step onboarding wizard ("set up everything") | "Cover all the configuration so users don't have to find Settings later" | Drop-off scales with steps. Calendly = 4 steps; Cal.com = 5; Acuity = 6. Going longer = trail of half-completed accounts | 3-4 steps max with sane defaults; everything is editable later in Settings. |
| Captcha on signup form | "Bot accounts" | Cloudflare Turnstile is already on `/api/bookings`. Adding to signup is overhead until we see actual signup spam | Defer until spam observed in production. |
| Email-verify-required-before-ANY-action (including read-only) | "Maximum security" | Users who want to evaluate the product can't even see their dashboard. Higher abandon rate | Hard gate on creating bookings/events; soft for navigating dashboard. (Compromise: gate everything except `/app/settings/profile` so they can change typo'd email.) |

---

## B. Capacity-Aware Booking (1 host, N attendees per slot)

### Table Stakes (v1.1 must ship)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `max_bookings_per_slot` column on `event_types` | Andrew's prod observation: double-booking succeeded. **Investigate root cause first** before adding new column — may be partial-index gap, not capacity gap | S | Migration: `ALTER TABLE event_types ADD COLUMN max_bookings_per_slot INTEGER NOT NULL DEFAULT 1 CHECK (max_bookings_per_slot >= 1)`. |
| Per-event-type capacity setting (NOT per-account) | Calendly does it per-event-type. Per-account would prevent owner from having "1-on-1 consultation" + "8-person workshop" at the same account | S | Already aligned with Calendly's UX (verified in search: "max invitee limit which automatically applies to all time slots on that event type"). |
| Owner UI in event-type form: capacity input | "Maximum bookings per slot: ___ (default 1)" | S | Add to existing `event-type-form.tsx`. Number input, min=1, no max (or arbitrary cap like 100). Note that v1.1 tech debt: this form already has `react-hooks/incompatible-library` warning per FUTURE_DIRECTIONS §4 — opportunity to refactor `watch()` -> `useWatch` while editing. |
| Slot API enforces capacity in availability calculation | If slot has 8 capacity and 8 confirmed bookings, hide from picker. If 7/8, slot still appears | M | `lib/availability/compute-slots*.ts` already exists; add `bookings_count` left-join on (event_type_id, start_at) and filter `count < max_bookings_per_slot`. Existing tests must pass + new test for partial capacity. |
| Booking API enforces capacity at insert time | Race-safe insert when capacity > 1 — partial unique index pattern from v1.0 does NOT apply | L | **This is the central correctness problem of Phase 11.** See dedicated section below. |
| Race-safe enforcement when capacity > 1 | Same correctness bar as v1.0 (verified by automated race tests) | L | See "Capacity race-safety pattern" below. |
| Default capacity = 1 for new event types | Andrew explicit; matches existing v1.0 behavior; preserves partial-unique-index semantics | S | DB DEFAULT 1; UI default 1. |

### Capacity Race-Safety Pattern (architectural commitment for Phase 11)

The v1.0 partial unique index `bookings_no_double_book ON (event_type_id, start_at) WHERE status='confirmed'` enforces "exactly 1 confirmed booking per slot." Capacity > 1 breaks this guard. Three patterns exist; **recommendation = Pattern A (advisory lock + count check)**:

**Pattern A — Postgres advisory lock per slot key (RECOMMENDED):**
- `SELECT pg_advisory_xact_lock(hashtext(event_type_id::text || start_at::text))`
- Inside the lock: `SELECT count(*) FROM bookings WHERE ... AND status='confirmed' FOR UPDATE`
- If `count < max_bookings_per_slot`: insert booking. Else: return 409.
- Lock auto-releases at transaction end.
- Pro: clean app-layer semantics; existing `lib/supabase/admin.ts` service-role pattern works.
- Con: requires wrapping in a Postgres function (RPC) for transactional semantics — supabase-js can't `BEGIN` natively.

**Pattern B — `SERIALIZABLE` isolation level:**
- Set transaction isolation to SERIALIZABLE; do read + insert.
- Postgres's SSI detects conflicts and aborts one transaction with `40001`.
- Pro: declarative; no explicit lock.
- Con: must implement client-side retry logic; SERIALIZABLE has overhead; doesn't fit supabase-js cleanly.

**Pattern C — Keep partial unique index for capacity=1, advisory lock for capacity>1:**
- Hybrid. Adds branching at insert site.
- Pro: zero-regression for v1.0 default (capacity=1).
- Con: two enforcement paths to test/maintain.

**Recommendation rationale:** Pattern A is the canonical Postgres pattern (per FireHydrant/Oneuptime/EnterpriseDB articles). Wrap as `book_slot(event_type_id, start_at, ...)` RPC — it owns the lock + count + insert atomically. Keep partial unique index in place for defense-in-depth (still catches capacity=1 races even if RPC has a bug). v1.0 race-test pattern (20 concurrent `Promise.all` posts) extends naturally — must produce exactly N successes and (concurrency - N) 409s.

### Differentiators (capability-tier)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "X spots left" indicator on booking page | Calendly offers it as an OPTIONAL toggle. Creates urgency; useful for workshops | S | Boolean column `event_types.show_remaining_capacity`. UI checkbox in event-type form. Slot API includes `remaining_capacity` in response when toggled on. **Recommendation: include in v1.1** — small effort, real value for the workshop use case. Default OFF (preserves Calendly's privacy default). |
| "X spots left" only at threshold (e.g., when <=2 remain) | Compromise — urgency without revealing total capacity always | S | Extra `low_stock_threshold` int column. **Skip in v1.1** — over-engineered toggle inside a toggle. |
| Soft warning when capacity is being raised on an event with existing bookings | Prevent owner from accidentally undercutting bookers' expectations ("oh wait, this was a 1-on-1 and now it's a workshop?") | S | Confirmation modal in event-type form. **Include in v1.1** — small effort, prevents support emails. |
| Capacity-aware reminder email ("You and 7 others are confirmed for...") | Group-event-specific UX | M | Requires booker name list in template + per-recipient render. **Skip in v1.1** — privacy concern (don't expose other bookers' names without consent); v1.2 if Andrew gets this complaint. |
| Configurable minimum-attendee threshold ("workshop requires >=3 to run") | Some group events need a floor | M | Adds `min_bookings_to_confirm` + status `tentative` until met. **Skip in v1.1** — Calendly itself doesn't have this; way out of scope. |

### Anti-features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Waitlist when slot is full | "Calendly has waitlists" / Andrew might want it | Out of Scope per PROJECT.md ("Waitlists / Group bookings — complexity not justified by demand in this vertical"). Adds notification flow, queue ordering, transactional state machines. v1.1 already has 3 capability areas | Slot disappears when full (existing v1.0 behavior). If Andrew gets requests post-v1.1, revisit in v1.2. |
| Round-robin (N hosts, 1 booker) | "Cal.com has it" | Out of Scope per PROJECT.md ("anti-feature; targets enterprises, not solo trade contractors"). Requires team/multi-user — also out of scope | Single-host events only. |
| Per-slot capacity overrides (different limits at different times) | "What if I want 5 spots at 9am but 10 spots at 11am?" | Calendly only allows this AFTER first booking on a slot (per search results). Adds an entire new override layer | Per-event-type capacity only. Owner creates a second event type if they need different capacities. |
| Group-call video integration | "Workshops need a Zoom link" | Out of Scope per PROJECT.md ("Video conferencing integration — trade bookings are in-person") | Custom question: "Send Zoom link manually" or owner adds to confirmation note. |
| Capacity 0 to "pause" an event | "Faster than toggling active" | Confusing semantics ("capacity 0" looks like a bug, not an action) | Use existing `event_types.is_active` toggle. |

---

## C. Branded UI Overhaul (5 Surfaces)

### Surfaces Affected

1. **Owner dashboard** — `/app/*` (Home, Event Types, Availability, Branding, Bookings, Settings)
2. **Public booking page** — `/[account]` index + `/[account]/[event-slug]`
3. **Embed widget** — `/embed/[account]/[event-slug]`
4. **Emails** — confirmation, reminder, cancel, reschedule (booker × owner = 6 templates per FUTURE_DIRECTIONS §3)
5. **Auth/signup pages** — `/login`, `/signup`, `/auth/reset-password`

The primary skill is `tailwind-landing-page` (Cruip "Simple Light"). The other website-creation skills (`hero-section-contractor`, `hero-section-medspa`, `roofing-template`, `artifacts-builder`) are for marketing-site heroes and one-off HTML artifacts — **not directly applicable** to a SaaS dashboard or transactional emails. The `different-styles` (elite-frontend-ux) skill's "commit to a bold direction" principle applies as meta-guidance but doesn't replace `tailwind-landing-page` as the primary system.

### Table Stakes (v1.1 must ship)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Inter font + tight tracking globally | Per `tailwind-landing-page` SKILL.md design system | S | `next/font/google` Inter import; `--font-inter` CSS var; `font-inter tracking-tight` on `<body>`. Already partial in v1.0. |
| `bg-gray-50` page background + gray-900 primary text | Light-on-gray base from skill | S | Single `app/(shell)/app/layout.tsx` + public-page layout change. |
| Single brand-accent color (per-account) replaces blue everywhere | Multi-tenant variant of skill's "blue is the sole accent." Each account sees its `brand_primary` where the template uses `blue-500`/`blue-600` | M | Already partially shipped in v1.0 (`BrandedPage` wrapper sets CSS vars). Extend coverage to dashboard + auth pages (currently those don't theme per-account because account context isn't loaded). |
| Per-account `background_color` token | Andrew explicit: `accounts.background_color` (hex, nullable) controls the page-background hue (in addition to existing `brand_primary` for accents) | S | Migration: `ALTER TABLE accounts ADD COLUMN background_color TEXT` (default NULL -> falls back to `gray-50`). UI swatch picker in branding editor. |
| Per-account `background_shade` token | Andrew explicit: controls gradient INTENSITY (e.g., enum `none` / `subtle` / `bold`). Maps to opacity on the gradient blur circles from the skill | S | Migration: `ALTER TABLE accounts ADD COLUMN background_shade TEXT CHECK (background_shade IN ('none','subtle','bold')) DEFAULT 'subtle'`. UI = 3-button toggle. |
| Floating glass header pill (dashboard top nav) | Skill's signature header pattern | M | shadcn doesn't ship this; hand-roll per skill spec (line 113-126). Position: `fixed top-2 md:top-6`. |
| Gradient blur-circle decorative backgrounds | Skill's depth pattern; controlled by `background_shade` | M | Two or three `w-80 h-80 rounded-full bg-linear-to-tr from-[brand-primary] opacity-50 blur-[160px]` divs per surface. Conditional on `background_shade != 'none'`. |
| Sidebar IA: Home / Event Types / Availability / Bookings / Branding / Settings | Existing v1.0 = Event Types / Availability / Branding / Bookings (no Settings, no Home). v1.1 adds 2 entries; rationale = Settings was discoverability gap (Andrew flagged), Home is the new default landing | M | Update `app/(shell)/app/_components/sidebar.tsx`. Reorder so Home is first. Group Branding+Settings under a "Customization" or similar collapsible group OR keep flat (recommend flat — 6 items is fine; collapsing adds clicks). |
| Home tab = monthly calendar with click-day -> drawer of bookings | Andrew explicit. Confirmed not the default in Calendly (per search: Calendly's default is the Event Types page, not a calendar). **This is a NSI-specific differentiator.** | L | New component `app/(shell)/app/page.tsx` (currently redirects elsewhere). Use `react-day-picker` (already in stack) in `month` mode with `modifiers` for days-with-bookings. Click -> shadcn `Sheet` (drawer) populated via Server Action. |
| `/app/settings/*` route group | Discoverability fix — Andrew flagged "no UI for settings discovery" as a v1.1 driver | M | New route(s): `/app/settings/profile`, `/app/settings/account` (slug, timezone, danger zone). Reminder Settings already exists at `/app/settings/reminders` per v1.0 Phase 8 dashboard walkthrough — confirm placement. |
| Embed snippet dialog widening fix | shadcn `Dialog` default `max-w-lg` is too narrow for embed code snippet (causes line-wrap and copy-paste pain) | S | Add `className="max-w-2xl"` (or `sm:max-w-2xl`) to the `DialogContent` in the embed-snippet dialog. Trivial CSS-class change. |
| Public booking page restyled per skill | Match the polish bar Andrew expects ("website feel") | L | Section rhythm `py-12 md:py-20`, `max-w-3xl` for the slot picker, gradient backgrounds, primary-CTA button pattern (`bg-linear-to-t from-[brand]-600 to-[brand]-500`). |
| Auth pages restyled per skill (split-panel) | `/login`, `/signup`, `/auth/reset-password` | M | Skill's auth-page pattern (line 240-244): two-column on `lg:`, form left, decorative panel right. Decorative panel can be a subtle "Booking, simplified" promo with branded gradient. |
| Email per-account gradient header | Andrew's ask. Adds visual brand to confirmation/reminder/cancel/reschedule emails | M | **WARNING — see anti-features.** Apple Mail YES; Gmail PARTIAL; Outlook NO; Yahoo NO. Standard fix: solid-color fallback (`background-color: [brand_primary]`) THEN `background-image: linear-gradient(...)` on top. Outlook ignores the gradient and gets the solid color. Acceptable. |
| Plain-text alternative on confirmation email | Mirrors reminder pattern; mail-tester score impact | S | Add `text: stripHtml(html)` to `lib/email/send-booking-confirmation.ts` `sendEmail()` call. Trivial. Folds into Phase 12 emails work per PROJECT.md. |
| NSI mark image in "Powered by NSI" footer | Currently text-only (`NSI_MARK_URL = null`) | S | Add `/public/nsi-mark.png`; set `NSI_MARK_URL`. Per FUTURE_DIRECTIONS §3. Trivial. |
| 6-row branding smoke (booker × owner × confirm/cancel/reschedule) | Per FUTURE_DIRECTIONS §3 — folds into emails work | M | Per-template visual smoke: each template renders the new gradient header with per-account color/shade. |

### Differentiators (capability-tier)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Day-detail drawer shows booking metadata + actions (cancel, reschedule, view) | Beyond just listing — make it a mini-management surface | M | Each booking row has shadcn `DropdownMenu` with Phase 8 booking-detail-page actions (cancel, copy link, etc). **Include in v1.1** — small incremental effort over basic drawer; large UX value. |
| Calendar view density indicators (heatmap-style) | Days with more bookings show darker | S | `react-day-picker` `modifiersClassNames` based on count. **Skip in v1.1** — over-engineered for solo trade contractors who rarely have 5+ bookings/day. |
| Animated AOS scroll reveals on public booking page | Skill includes AOS at `data-aos="zoom-y-out"` | M | Adds `aos` dependency. **Skip in v1.1** — booking pages are short and task-focused; scroll animations are landing-page-only. |
| Custom auth-page decorative panel (mock-browser illustration) | Skill's auth pattern includes this | M | **Skip in v1.1** — generic gradient panel is sufficient; bespoke illustration is over-engineering for a transactional auth page. |
| Dark-mode dashboard toggle | "Modern SaaS expectation" | L | Skill is light-themed only; would require theme infrastructure. **Skip in v1.1** — out of scope; revisit v1.3+. |
| Per-event-type theme override | Calendly considered this a power-user feature | M | Out of scope per existing v1.0 anti-feature ("Custom CSS white-label"). Per-account is sufficient. |
| Public-facing `/[account]` index landing card | Andrew has `/[account]` index page in v1.0 listing event types. Skill-style polish makes it a real "personal landing" | M | **Include in v1.1** — relatively small incremental effort; this is the URL trade contractors share on business cards. |

### Anti-features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Custom CSS / arbitrary stylesheet upload per account | "Full white-label" / "match my exact website" | Already explicit Out of Scope per PROJECT.md. XSS surface (CSS can `@import` data: URLs). Support burden when client's CSS breaks layout | Per-account `brand_primary` + `background_color` + `background_shade` + `logo_url` is the v1.1 ceiling. Custom domain (CNAME) is a separate v2+ feature. |
| Custom HTML email templates per account | "I want my email to look exactly like my brand" | Multiplies QA matrix by N accounts × 6 templates × 4 email clients. Unmaintainable. Apple Mail's `border-radius` quirks already documented in v1.0 (FUTURE_DIRECTIONS §1) — multiplying by N templates is untenable | Per-account header gradient (color/shade only) + logo. Body copy stays standard across accounts. |
| Multiple themes / theme presets ("Light", "Dark", "Vibrant") | "Choice is good" | More toggles for owners; less consistency for bookers; QA explosion. Per skill's principle: "Commit to one accent color with gray as the workhorse." | One light theme (Cruip Simple Light), per-account brand color + background tone. |
| SVG logo upload | "Customers have SVG logos" | Already explicit Out of Scope per FUTURE_DIRECTIONS §2 — XSS surface. PNG-only in v1; deferred to v1.2 with sanitization | PNG only (existing v1.0 constraint). 2 MB cap. |
| Email animations (CSS keyframes, GIFs) | "Make emails feel modern" | Outlook strips animations; Apple Mail iOS often blocks GIFs; `prefers-reduced-motion` is unreliable in email | Static gradient header only. |
| Per-tenant subdomain (`andrew.calendar-app.com`) | "Looks more professional" | Already explicit Out of Scope per PROJECT.md ("Custom subdomains... DNS work deferred"). Wildcard SSL + Vercel domain config + per-tenant routing = significant infra work | Path-based `/[account]` URLs (existing v1.0). Custom domains in v2+. |

---

## Feature Dependencies

```
[Multi-user signup (A)]
    |--HARD-blocks-on--> [/auth/callback fix (v1.0 tech debt)]
    |                         FUTURE_DIRECTIONS.md §1, line 45-46
    |--provisions--> [Default availability seed]
    |                     reuses v1.0 availability_rules schema
    +--provisions--> [Default event type seed]
                          reuses v1.0 event_types schema
                          requires Phase 11 max_bookings_per_slot=1 default

[Capacity (B)]
    |--extends--> [v1.0 partial unique index]
    |                 keep for defense-in-depth at capacity=1
    |--requires--> [Postgres advisory lock RPC OR SERIALIZABLE retry]
    |                 NEW Phase 11 work; lib/supabase/admin.ts pattern reused
    |--extends--> [v1.0 lib/availability/compute-slots.ts]
    |                 add capacity-aware slot filtering
    +--extends--> [v1.0 race-test pattern]
                       N concurrent posts -> exactly capacity successes + rest 409

[UI overhaul (C)]
    |--depends-on--> [Multi-user signup (A) deployed]
    |                    auth pages restyling needs /signup to exist first
    |--depends-on--> [Capacity (B) deployed]
    |                    event-type form gets new capacity input + UI must include it
    |--extends--> [v1.0 BrandedPage wrapper]
    |                 add background_color + background_shade tokens
    |--extends--> [v1.0 lib/email/branding-blocks.ts]
    |                 NSI_MARK_URL fix + gradient header + plain-text alt
    +--fixes--> [v1.0 embed snippet dialog width]
                    shadcn Dialog max-w override

[Cross-cutting v1.0 dependencies the user must NOT break]
    |--MUST-PRESERVE--> [partial unique index bookings_no_double_book]
    |                       (defense-in-depth even if RPC owns capacity logic)
    |--MUST-PRESERVE--> [proxy.ts as sole CSP/X-Frame-Options owner]
    |                       (any new auth/signup pages must NOT touch next.config.ts headers)
    |--MUST-PRESERVE--> [import "server-only" on lib/supabase/admin.ts]
    |                       (signup provisioning RPC will be called from Server Action)
    +--MUST-PRESERVE--> [lib/email-sender vendored shape]
                            (welcome email goes through same Gmail SMTP path)
```

### Dependency Notes

- **A blocks on `/auth/callback` fix:** This is the single hardest blocker. Multi-user signup REQUIRES a working email-confirmation callback. The same route also unlocks password reset. This is the first task of Phase 10. Per FUTURE_DIRECTIONS §1, this is currently a 404. Phase 10's Plan 10-01 must own this fix or the entire phase stalls.
- **A provisions B's default:** Account auto-provisioning inserts a default event type with `max_bookings_per_slot=1`. This is a soft dep — both phases can be developed in parallel as long as Phase 10's seed code knows about the new column once Phase 11 lands the migration. Concrete suggestion: Phase 11 migration runs FIRST, then Phase 10 seed code can target it.
- **C depends on A and B:** UI overhaul touches the event-type form (B's new capacity input must be styled) and auth pages (A's `/signup`, `/login`, `/auth/reset-password` must exist to be styled). This argues for ordering: A -> B -> C, which matches PROJECT.md's stated phase order.
- **Critical preservation: partial unique index:** Even when capacity > 1 owns enforcement at the RPC layer, the v1.0 partial unique index `(event_type_id, start_at) WHERE status='confirmed'` should NOT be dropped at capacity=1 — it's defense-in-depth. Schema change in Phase 11 should keep it (perhaps refined to `WHERE status='confirmed' AND (SELECT max_bookings_per_slot FROM event_types ...) = 1`, or just leave as-is and let it fire benignly).

---

## MVP Definition for v1.1

### Launch With (must ship in v1.1)

**A — Multi-user signup:**
- [ ] `/auth/callback` route handler (signup + recovery + magic-link path support) — **BLOCKER, fix first**
- [ ] `/signup` form (email + password + slug picker w/ collision detection)
- [ ] Hard email-verify gate before first dashboard access
- [ ] Account auto-provisioning RPC (account row + 5 availability rules + 1 default event type)
- [ ] Default Mon-Fri 9-5 in user's local TZ
- [ ] Default "30 Minute Meeting" event type with `max_bookings_per_slot=1`
- [ ] First-login wizard (3-4 steps with skip)
- [ ] `/app/settings/profile` (display name, email change, password change)
- [ ] Soft-delete account ("danger zone")
- [ ] Working password reset flow

**B — Capacity:**
- [ ] Investigation task FIRST: reproduce Andrew's prod double-booking; identify whether root cause is partial-index gap or capacity gap
- [ ] Migration: `event_types.max_bookings_per_slot` int default 1
- [ ] Owner UI: capacity input on event-type form
- [ ] Slot computation respects capacity
- [ ] Race-safe insert via Postgres advisory lock RPC (`book_slot`)
- [ ] Race test: N concurrent posts -> exactly capacity successes
- [ ] Optional "show remaining capacity" toggle (skill differentiator we're folding into table-stakes given small effort)
- [ ] Confirmation modal when capacity is raised on event with existing bookings

**C — Branded UI overhaul:**
- [ ] Inter + tracking-tight + bg-gray-50 base across all surfaces
- [ ] Per-account `background_color` + `background_shade` migrations
- [ ] Branding editor extended with new color/shade controls
- [ ] BrandedPage wrapper extended for new tokens
- [ ] Floating glass header pill on dashboard
- [ ] Sidebar IA: Home + Event Types + Availability + Bookings + Branding + Settings
- [ ] Home tab: monthly calendar + day-drawer with booking actions
- [ ] Auth pages (split panel)
- [ ] Public booking page restyled
- [ ] `/[account]` index landing restyled
- [ ] Embed widget restyled (within iframe sizing constraints)
- [ ] Embed snippet dialog widening fix
- [ ] Email gradient header (with Outlook solid-color fallback)
- [ ] Plain-text alternative on confirmation email
- [ ] NSI mark in email footer
- [ ] 6-row branding smoke (booker × owner × confirm/cancel/reschedule)
- [ ] `RESERVED_SLUGS` deduplication (folds into Phase 10 anyway)

### Add After Validation (v1.2)

- [ ] OAuth signup (Google/GitHub)
- [ ] Magic-link login
- [ ] Onboarding progress checklist
- [ ] Capacity-aware reminder email ("you and N others")
- [ ] Slug suggestion-on-collision (if v1.1 drop-off observed)
- [ ] Account email change with dual-confirmation
- [ ] Animated AOS reveals on public booking page

### Future Consideration (v2+)

- [ ] Multi-user-per-account / team seats
- [ ] Stripe paid tiers
- [ ] Custom subdomains / CNAME
- [ ] Round-robin scheduling
- [ ] Waitlist when capacity full
- [ ] Dark-mode dashboard
- [ ] SVG logo upload (sanitized)
- [ ] Custom HTML email templates

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `/auth/callback` route fix | HIGH (blocker) | LOW | P1 |
| `/signup` form + slug picker | HIGH | MEDIUM | P1 |
| Email verification gate | HIGH | LOW | P1 |
| Account auto-provisioning RPC | HIGH | MEDIUM | P1 |
| Default availability/event-type seed | HIGH | LOW | P1 |
| First-login wizard (3-4 steps) | MEDIUM | MEDIUM | P1 |
| `/app/settings/profile` | HIGH | MEDIUM | P1 |
| Password reset flow | HIGH | LOW | P1 |
| Account soft-delete | MEDIUM | LOW | P1 |
| `max_bookings_per_slot` migration + UI | HIGH | LOW | P1 |
| Advisory-lock RPC for capacity-safe insert | HIGH | HIGH | P1 |
| Slot computation respects capacity | HIGH | MEDIUM | P1 |
| "Show remaining capacity" toggle | MEDIUM | LOW | P1 |
| Per-account `background_color` + `_shade` | HIGH | LOW | P1 |
| Sidebar IA + Settings group | HIGH | LOW | P1 |
| Home tab monthly calendar + drawer | HIGH | HIGH | P1 |
| Public booking page restyled | HIGH | HIGH | P1 |
| Auth pages restyled | MEDIUM | MEDIUM | P1 |
| Embed snippet dialog widening | MEDIUM | LOW | P1 |
| Email gradient header (with fallback) | MEDIUM | MEDIUM | P1 |
| Plain-text alt on confirmation | LOW (deliverability) | LOW | P1 |
| NSI mark in email footer | LOW | LOW | P1 |
| Slug suggestion-on-collision | MEDIUM | MEDIUM | P2 |
| OAuth signup | MEDIUM | HIGH | P3 |
| Onboarding checklist on dashboard | LOW | MEDIUM | P3 |
| Custom subdomains | LOW (vertical-fit) | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.1
- P2: Should have, add when possible (capability-tier scope conversation)
- P3: Nice to have, future consideration (v1.2+)

---

## Competitor Feature Analysis

| Feature | Calendly | Cal.com | SavvyCal | Acuity | Our v1.1 Approach |
|---------|----------|---------|----------|--------|-------------------|
| Signup wizard length | 4 steps (name, slug, calendar, availability) | 5 steps (name, slug, avatar, availability, calendar) | 3-4 steps | 5-6 steps | 3-4 steps with skip-from-step-2; sane defaults |
| Default event types on signup | 1 ("30 Minute Meeting") | 3 (15-min, 30-min, "Secret Meeting") | 1-2 | 1 | 1 ("30 Minute Meeting", capacity=1) |
| Default availability | Mon-Fri 9-5 in user's TZ | Mon-Fri 9-5 in user's TZ | Mon-Fri 9-5 in user's TZ | Mon-Fri 9-5 in user's TZ | **Mon-Fri 9-5 in user's TZ** (matches industry default) |
| Email-verify gate | Soft (banner; can use product) | Hard (blocks login) | Hard | Soft | **Hard** (lower orphan rate, simpler ops) |
| Slug collision UX | Suggestion list | Inline error + retry | Suggestion list | Inline error | **Inline error in v1.1** (P1); suggestions in v1.2 (P2) if drop-off observed |
| Group event capacity location | Per-event-type, "Invitee limit" | Per-event-type | Per-event-type | Per-event-type | **Per-event-type** (matches all 4 competitors) |
| Show "spots left" | Optional toggle | Optional toggle | Optional toggle | Optional | Optional toggle, default OFF |
| Slot full UX | Slot disappears | Slot disappears | Slot disappears | Slot disappears | **Slot disappears** (matches; no waitlist) |
| Per-account branding ceiling | Logo + 1 color (Premium) | Logo + theme + dark mode (free for self-host) | Logo + colors | Logo + colors + custom CSS (premium) | **Logo + brand_primary + background_color + background_shade** |
| Default home page on login | Event Types list | Event Types list | Calendar week view | Calendar daily view | **Monthly calendar with drawer** (NSI differentiator; matches SavvyCal/Acuity philosophy more than Calendly) |
| Sidebar items | Home, Event Types, Meeting Polls, Workflows, Routing, Integrations, Apps | Event Types, Bookings, Availability, Teams, Apps, Routing, Workflows, Settings | Event Types, Schedules, Subscribers, Settings | Calendar, Clients, Reports, Forms, Settings | **Home, Event Types, Availability, Bookings, Branding, Settings** (6 items, flat — solo-contractor scope) |
| Email gradient header | No (solid color brand bar) | No (no per-account email branding) | No | No | **Yes, with Outlook solid-color fallback** (NSI differentiator; modest extra render risk) |

**Key takeaway:** v1.1 stays inside Calendly/Cal.com/SavvyCal/Acuity feature parity for signup + capacity (matches industry defaults). UI overhaul intentionally goes BEYOND competitors on visual polish — that's the NSI wedge. Sidebar IA is intentionally narrower than competitors (no Workflows/Integrations/Routing) to match solo-contractor scope.

---

## Sources

### Primary (HIGH confidence)
- [Calendly Group event type overview](https://help.calendly.com/hc/en-us/articles/14073282345111-Group-event-type-overview) — capacity 2-9999, "Display remaining spots" toggle, per-event-type setting
- [Calendly Multi-person scheduling options](https://help.calendly.com/hc/en-us/articles/14077508073111-Multi-person-scheduling-options-for-your-organization) — Group vs Round Robin distinction
- [Calendly Different Invitee Limits per slot](https://community.calendly.com/featured-tips-tricks-32/different-invitee-limits-for-different-time-slots-in-group-event-types-1122) — confirms "single max invitee limit per event type"
- [Cal.com Event Types Guide](https://cal.com/blog/event-types-guide-calcom) — three default event types (15/30/Secret Meeting)
- [Cal.com Members Onboarding](https://cal.com/help/enterprise/members-onboarding) — onboarding step sequence
- [Cal.com White Label Approach](https://cal.com/blog/how-white-label-calendar-scheduling-infrastructure-impacts-brands) — per-tenant branding ceiling
- [Calendly Setup Guide](https://calendly.com/learn/calendly-setup) — onboarding flow + welcome modal
- Tailwind Landing Page SKILL.md (local: `website-creation/.claude/skills/tailwind-landing-page/SKILL.md`) — primary design system
- [Litmus: HTML Email Background Colors and Gradients](https://www.litmus.com/blog/background-colors-html-email) — Apple Mail YES, Gmail PARTIAL, Outlook NO
- [Can I email — linear-gradient()](https://www.caniemail.com/features/css-linear-gradient/) — current support matrix
- [Maizzle Gradients Guide](https://maizzle.com/guides/gradients) — VML fallback pattern for Outlook
- PROJECT.md (this repo, `.planning/PROJECT.md`) — v1.1 scope, ordering, anti-features
- FUTURE_DIRECTIONS.md (this repo, repo root) — v1.0 deferred items, tech debt
- [Postgres advisory lock pattern (FireHydrant)](https://firehydrant.com/blog/using-advisory-locks-to-avoid-race-conditions-in-rails/) — `pg_advisory_xact_lock` recipe
- [PostgreSQL race conditions (OneUptime)](https://oneuptime.com/blog/post/2026-01-25-postgresql-race-conditions/view) — advisory lock vs SERIALIZABLE comparison
- [Postgres SERIALIZABLE in PG 11+ (EnterpriseDB)](https://www.enterprisedb.com/blog/serializable-postgresql-11-and-beyond) — SERIALIZABLE retry semantics

### Secondary (MEDIUM confidence)
- [Formbricks: 7 User Onboarding Best Practices for 2026](https://formbricks.com/blog/user-onboarding-best-practices) — wizard length tradeoffs
- [Chameleon: Optimize SaaS User Onboarding](https://www.chameleon.io/blog/optimize-saas-user-onboarding) — checklist pattern, drop-off analysis
- [Arcade: Customer Onboarding Best Practices for SaaS in 2026](https://www.arcade.software/post/customer-onboarding-best-practices) — soft-vs-hard email-verify
- [SavvyCal vs Calendly comparisons](https://savvycal.com/calendly-vs-savvycal) — UX philosophy differences
- [Cal.com vs SavvyCal 2026 (YouCanBook.me)](https://youcanbook.me/blog/savvycal-vs-cal-dot-com) — feature comparison
- [SaaS UX 2026 (Mouseflow)](https://mouseflow.com/blog/saas-ux-design-best-practices/) — autocomplete/suggestion patterns

### Tertiary (LOW confidence — flag for verification before phase implementation)
- Specific Calendly/SavvyCal/Acuity onboarding step counts in 2026 — verify by walking through their actual signup flows during Phase 10 planning
- Exact Outlook 365 (desktop) gradient rendering as of 2026 — verify with email-testing tool (Litmus / Email on Acid) before Phase 12 final QA
- Gmail dark-mode color inversion of brand-primary header — flag for Phase 12 deliverability test (mail-tester.com)

---

*Feature research for: v1.1 multi-user + capacity + branded UI overhaul*
*Researched: 2026-04-27*
*Quality gate: categories explicit; S/M/L complexity noted; v1.0 dependencies identified; >=2 anti-features per category area; Calendly/Cal.com/SavvyCal/Acuity benchmarked*
