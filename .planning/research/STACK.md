# Technology Stack

**Project:** calendar-app (multi-tenant Calendly-style booking tool)
**Researched:** 2026-04-18
**Overall confidence:** MEDIUM-HIGH

> **Version verification note:** Specific version numbers below are based on knowledge as of January 2026. Before installing, verify current versions with `npm view <package> version`. The *choice* of library is HIGH confidence; exact pinned versions should be re-checked at install time.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | ^15.x (App Router) | Full-stack React framework, hosts booking pages + API routes + widget loader script | App Router is the supported default since Next 13.4 GA; Server Components drastically reduce client JS for the booking page (SEO-friendly public pages). Route handlers replace API routes cleanly. Vercel-native deployment matches your hosting. |
| React | ^19.x | UI runtime | React 19 is stable and required/recommended by Next 15. `useActionState` / Server Actions simplify the booker form flow. |
| TypeScript | ^5.6+ | Type safety | Non-negotiable for multi-tenant RLS work — type-level guarantees prevent tenant-leak bugs. Use `strict: true`. |
| Node.js | 20 LTS (or 22 LTS) | Runtime | Vercel's default. Avoid 18 (EOL April 2025). |

**App Router vs Pages Router decision: App Router.** Reasons:
- Server Components let the public booking page render with near-zero client JS except the date/time picker island.
- Route Handlers + Server Actions cleanly cover form submits.
- Official Supabase SSR guidance (`@supabase/ssr`) is written against App Router.
- Pages Router is maintenance-mode; no new features.

Confidence: HIGH (Next.js + App Router + React 19 is the current default path).

---

### Backend / Data

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase (hosted) | Free tier | Postgres + Auth + Storage | Matches your stack preference. RLS gives you per-tenant isolation at the DB layer — critical for multi-tenant. |
| `@supabase/supabase-js` | ^2.45+ | JS client | Core client. |
| `@supabase/ssr` | ^0.5+ | Next.js cookie-based auth | **Replaces the deprecated `@supabase/auth-helpers-nextjs`.** Works with App Router, middleware, Server Components, Route Handlers, and Server Actions. |
| PostgreSQL | 15+ (Supabase default) | Data store | RLS, `tstzrange`, generated columns, `pg_cron` extension. |

**Auth UI decision: Build custom, not `@supabase/auth-ui-react`.**
- Auth-UI is in maintenance mode and styling it to match per-tenant branding is painful.
- A custom email+password / magic-link form with React Hook Form + Zod is ~80 lines and fully themeable.
- Use `supabase.auth.signInWithOtp` / `signInWithPassword` directly.

**RLS pattern:** Every tenant-scoped table gets `account_id uuid not null references accounts(id)`. Policies check `account_id = (select account_id from account_members where user_id = auth.uid())`. Use a SQL function + index for perf. Confidence: HIGH.

---

### Date / Time / Timezone (CRITICAL)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `date-fns` | ^4.x | Date math | Tree-shakeable, immutable, pure functions. v4 added first-class timezone support via `@date-fns/tz`. |
| `@date-fns/tz` | ^1.x | IANA timezone handling | Official companion to date-fns v4 — replaces the old `date-fns-tz` third-party package for v4+. Handles DST correctly. |
| `@vvo/tzdb` | ^6.x | Timezone picker data | Clean list of IANA zones with group labels + offsets for the booker's timezone selector. Keeps the UI from showing 400+ raw IANA names. |

**Decision rationale (date lib bake-off):**

| Lib | Verdict | Reason |
|-----|---------|--------|
| **date-fns v4 + @date-fns/tz** | CHOSEN | Tree-shakes to ~5 KB for booking page; v4's timezone API is clean; actively maintained. |
| Luxon | Strong runner-up | Excellent TZ support, but ~20 KB min-gzip baseline hurts the widget payload. |
| Day.js | Avoid for this | Plugin-based TZ handling is error-prone; DST edge cases surface as bugs. |
| Moment.js | **Avoid** | In maintenance mode, huge, mutable. |
| Temporal (native) | Not yet | Stage-3 TC39; Firefox has it behind a flag, Safari/Chrome still shipping. Use polyfill only if you want to migrate in 1–2 years; don't bet MVP on it. |

Confidence: HIGH. Date handling is the #1 source of booking bugs — commit to one library and one convention (store UTC in Postgres as `timestamptz`, convert at render).

**Timezone convention (write this into CLAUDE.md for the project):**
1. All DB timestamps: `timestamptz` (Postgres stores UTC).
2. Event type availability: store as `(weekday, start_time, end_time, iana_tz)` — the host's timezone is a property of the schedule, not the booking.
3. Slot generation: done server-side in the host's TZ, then converted to the booker's TZ for display.
4. Never trust the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` blindly — let the booker override.

---

### .ics Calendar Invites

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `ics` | ^3.x | Generate .ics files | Pure JS, no native deps (works on Vercel Edge/Node), simple API, handles VEVENT + VALARM + METHOD:REQUEST for invite-style attachments. |

**Avoid:**
- `node-ical` — primarily a *parser*, not a generator. Wrong tool.
- `ical-generator` — works, but has a slightly heavier API and more deps. `ics` is leaner.
- Hand-rolling RFC 5545 — the line-folding and timezone rules will bite you.

**Pattern:**
- Generate one .ics per booking with `METHOD:REQUEST`, ORGANIZER = host, ATTENDEE = booker.
- Attach to both host + booker emails via Resend.
- Include a stable `UID` so updates/cancellations work (send `METHOD:CANCEL` with same UID on cancel).

Confidence: HIGH.

---

### Email

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Resend | (SaaS) | Transactional email | Already on your stack; free tier is 3k/month, 100/day. |
| `@nsi/email-sender` | existing | Shared wrapper | Per your NSI tooling — reuse rather than re-integrate Resend directly. |
| `react-email` / `@react-email/components` | ^3.x | Email templates | JSX-based templates, renders to HTML + plaintext, Resend plays nicely with it. Templates: booking confirmation, reminder (24h), cancellation, reschedule. |

Confidence: HIGH.

---

### Forms & Validation

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-hook-form` | ^7.53+ | Form state | Minimal re-renders, tiny, the de-facto React form lib. |
| `zod` | ^3.23+ | Schema validation | Shared schemas between client form validation and server action validation. Also use for parsing Supabase row shapes at the boundary. |
| `@hookform/resolvers` | ^3.x | RHF ↔ Zod bridge | Standard integration. |

**Pattern:** Define Zod schemas in `lib/schemas/` — one source of truth for booker form, event type config form, and server action input validation. Confidence: HIGH.

---

### UI Primitives / Styling

| Tech | Version | Purpose | Why |
|------|---------|---------|-----|
| Tailwind CSS | ^3.4+ (or v4 if stable) | Utility CSS | Your preference, matches NSI stack. |
| shadcn/ui | latest (CLI copy-in, no version pin) | Component base | Not a dependency — it copies code into your repo. Perfect for per-tenant branding (CSS vars for colors) and for the widget (fully bundled, no external CSS). |
| Radix UI primitives | ^1.x (comes via shadcn) | Accessible primitives | shadcn/ui uses Radix under the hood — Dialog, Popover, Select, etc. Built-in a11y. |
| `lucide-react` | ^0.4xx | Icons | shadcn default icon set; tree-shakes well. |

**Calendar/date picker decision:**

| Option | Verdict | Why |
|--------|---------|-----|
| **shadcn `<Calendar>` (wraps `react-day-picker` v9)** | CHOSEN | Styleable, a11y-complete, keyboard nav, ~12 KB. Plays with your theming. |
| Headless UI | Skip | No dedicated calendar primitive; you'd build from scratch. |
| MUI X DatePicker | Avoid | Huge (~100 KB+), theme collision with Tailwind. |
| `react-datepicker` | Avoid for this | CSS is awkward to retheme per-tenant. |

Confidence: HIGH.

---

### Cron / Scheduled Jobs (24h reminders)

| Option | Verdict |
|--------|---------|
| **Supabase `pg_cron` + `pg_net`** | **CHOSEN for primary reminder job** |
| Vercel Cron Jobs | Secondary option / acceptable fallback |
| Upstash QStash | Overkill for free tier |
| Inngest | Overkill for MVP |

**Rationale:**
- **pg_cron** lets a SQL job run every 5 min, selecting bookings where `starts_at BETWEEN now() + '23h55m' AND now() + '24h05m'` and `reminder_sent = false`, then calling an edge function via `pg_net` to trigger Resend. Keeps the source of truth (bookings) and the trigger in the same place — no coordination drift.
- **Vercel Cron** works but the free tier is limited to daily-granularity cron on Hobby plan (check current limits — this has tightened recently). pg_cron gives you arbitrary minute-level schedules for free.
- Use **Vercel Cron** as a backup nightly sweep (`0 2 * * *`) that reconciles any missed reminders — belt-and-suspenders.

**Pattern for the job:**
1. `bookings` table has `reminder_sent_at timestamptz` (nullable).
2. pg_cron runs every 5 min, `SELECT ... WHERE starts_at between now()+23h55m and now()+24h05m AND reminder_sent_at IS NULL`.
3. Edge Function sends email via Resend, then updates `reminder_sent_at = now()`.
4. Idempotency: the `IS NULL` check + update is done in one transaction.

Confidence: MEDIUM-HIGH. Verify `pg_cron` is still enabled on Supabase Free tier at project start — Supabase has historically kept it on free, but confirm.

---

### Embeddable Widget (CRITICAL DECISION)

**Decision: Script-injected iframe (primary) with a lightweight `<script>` loader.**

Three approaches considered:

| Approach | Verdict | Pros | Cons |
|----------|---------|------|------|
| **Script-injected iframe** | **CHOSEN** | Zero CSS/JS collision with host page; easy versioning; works in Squarespace/WP/any site that allows `<script>` or raw HTML; simple postMessage for resize + "booking complete" events | Iframe overhead (~negligible); need postMessage for height |
| Raw `<iframe>` tag | Acceptable fallback | Works where scripts are blocked (some Squarespace plans) | No dynamic resize; no event callbacks |
| Web Component | Avoid for v1 | Cool in theory | CSS inheritance issues, Shadow DOM styling friction, worse compatibility with Squarespace/WP page builders |
| Direct script injection (no iframe) | **Avoid** | — | CSS collisions with host site are a support nightmare; Tailwind will conflict with host's styles |

**Pattern (Calendly-style):**
```html
<!-- Customer pastes this -->
<div data-nsi-calendar="event-type-slug-123"></div>
<script src="https://book.yourdomain.com/widget.js" async></script>
```
- `widget.js` (tiny, ~3 KB gzipped): finds all `[data-nsi-calendar]` elements, creates an iframe pointing to `https://book.yourdomain.com/embed/{slug}`, sets up postMessage listeners for `resize` and `booking:complete`.
- Also ship a fallback: give users an `<iframe src="..." />` snippet for locked-down sites.
- Build the `widget.js` as a single bundled file via a dedicated route handler or a build step that outputs to `public/widget.js`.

**Also provide:** a hosted booking page at `book.yourdomain.com/{account}/{event-type}` that works standalone (for users who just want a Calendly-style link).

Confidence: HIGH — this is exactly how Calendly, Cal.com, SavvyCal, and TidyCal all do it.

---

### Testing

| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| Vitest | ^2.x | Unit tests | Fast, ESM-native, TS out of the box. Use for date/TZ logic (where most booking bugs live). |
| Playwright | ^1.48+ | E2E | The booking happy path + embed widget on a test host page must have E2E coverage. |
| `@testing-library/react` | ^16.x | Component tests | For the date picker + booker form. |

**MVP-tier minimum:** unit tests on slot-generation + TZ conversion, one Playwright smoke test for the booking flow end-to-end including email delivery (mock Resend). Confidence: HIGH.

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` | ^5.x | Short IDs | Booking confirmation codes, widget event-type slugs |
| `clsx` + `tailwind-merge` | latest | Class name utilities | Comes with shadcn/ui |
| `@vercel/analytics` | ^1.x | Page analytics | Free on Vercel, one-line install |
| `sonner` | ^1.x | Toast notifications | shadcn-compatible, better than `react-hot-toast` in 2026 |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 | Remix / React Router v7 | Fine framework, but you're standardized on Next/Vercel |
| Auth | Supabase Auth (custom UI) | Clerk, Auth.js | Clerk costs money at scale; Supabase Auth is free + already in your stack |
| DB | Supabase Postgres | PlanetScale, Neon | Supabase bundles auth+RLS+storage; less glue code |
| Date lib | date-fns v4 + @date-fns/tz | Luxon | Luxon is great but bigger; date-fns wins on bundle size |
| Date lib | date-fns v4 + @date-fns/tz | Temporal | Not yet universally shipped in 2026; polyfill adds size |
| Calendar UI | react-day-picker (via shadcn) | MUI X DatePicker | MUI is huge and theme-hostile |
| Cron | Supabase pg_cron | Vercel Cron | pg_cron gives sub-hour granularity on free tier |
| Embed | Script-injected iframe | Web Component | Squarespace/WP compat issues with Web Components |
| Email templates | react-email | MJML, handcoded HTML | react-email is JSX, same mental model as the rest of the app |
| Forms | React Hook Form + Zod | Formik, native `<form>` | RHF is smaller + faster; Zod schemas reuse server-side |
| Icons | lucide-react | Heroicons, react-icons | shadcn default, tree-shakes per-icon |

---

## Installation (initial)

```bash
# Core
npx create-next-app@latest calendar-app --typescript --tailwind --app --eslint --src-dir

cd calendar-app

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Date/time
npm install date-fns @date-fns/tz @vvo/tzdb

# Forms + validation
npm install react-hook-form zod @hookform/resolvers

# .ics + email
npm install ics react-email @react-email/components

# UI (shadcn init will pull Radix + lucide + clsx + tailwind-merge)
npx shadcn@latest init
npx shadcn@latest add button input label calendar popover select dialog form toast

# Sonner (toasts, often not in default shadcn add)
npm install sonner

# Utilities
npm install nanoid
npm install @vercel/analytics

# Dev / testing
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
npm install -D @playwright/test
npx playwright install
```

**Verify versions at install:**
```bash
npm view next version
npm view react version
npm view @supabase/ssr version
npm view date-fns version
```

---

## Avoid These (explicit anti-list)

| Library / Pattern | Why Avoid |
|-------------------|-----------|
| **Moment.js** | Maintenance mode, mutable, huge (~70 KB). Use date-fns. |
| **`@supabase/auth-helpers-nextjs`** | Deprecated. Use `@supabase/ssr`. |
| **`@supabase/auth-ui-react`** | Maintenance mode; per-tenant theming is painful. Build a 100-line custom form. |
| **Pages Router** | Supabase SSR guidance, React 19 features, and Next.js new APIs assume App Router. |
| **Direct DOM injection widget (no iframe)** | CSS collisions with host site = endless support tickets. |
| **Web Component widget (for v1)** | Squarespace + WordPress page builders do inconsistent things with custom elements; shadow-DOM styling friction. Revisit post-MVP. |
| **`node-ical` for generation** | It's a parser. Use `ics`. |
| **Storing timestamps as `timestamp` (no TZ) in Postgres** | Guaranteed DST/offset bugs. Always `timestamptz`. |
| **Trusting `new Date(userString)` in the booker form** | Browsers parse inconsistently. Use explicit ISO-8601 + `@date-fns/tz`. |
| **MUI X DatePicker** | 10x the bundle size of react-day-picker; fights Tailwind. |
| **Client-side slot generation based on `Intl`** | Host's business hours must be computed server-side in the host's IANA TZ, then converted. Client-side computation leaks across DST boundaries. |
| **`setTimeout` / in-memory schedulers on Vercel** | Serverless = no long-lived processes. Use pg_cron or Vercel Cron. |
| **Day.js for booking timezone math** | Plugin-based TZ is a footgun at DST transitions. |
| **Tailwind classes in the embed iframe parent** | The iframe is isolated; host page CSS doesn't cross. Keep all styling inside the iframe. |
| **Mixing `supabase-js` client init in multiple places** | Create once in `lib/supabase/{server,client,middleware}.ts` per the official SSR guide. |

---

## Confidence Summary

| Area | Confidence | Notes |
|------|------------|-------|
| Next 15 + App Router + React 19 | HIGH | Official default path |
| Supabase + `@supabase/ssr` | HIGH | Official replacement for auth-helpers |
| date-fns v4 + `@date-fns/tz` | HIGH | v4 TZ API is recent but stable |
| `ics` library | HIGH | Widely used, no native deps |
| shadcn/ui + react-day-picker | HIGH | Standard 2026 combo |
| pg_cron for reminders | MEDIUM-HIGH | Verify still on Supabase Free tier at project start |
| Script-injected iframe widget | HIGH | Industry-standard pattern |
| Exact version pins | MEDIUM | Verify `npm view` before locking |

---

## Sources / Verification Path

Because live web search was unavailable during this research pass, the following should be spot-checked before locking the stack:

1. **Next.js + React versions:** `npm view next version` / `npm view react version` / check https://nextjs.org/blog
2. **Supabase SSR guide:** https://supabase.com/docs/guides/auth/server-side/nextjs — confirm `@supabase/ssr` is still the recommended package
3. **date-fns v4 TZ docs:** https://date-fns.org/docs/Getting-Started — confirm `@date-fns/tz` is the companion package name
4. **`ics` package:** https://www.npmjs.com/package/ics — confirm API
5. **Supabase pg_cron availability on Free tier:** https://supabase.com/docs/guides/database/extensions/pg_cron
6. **Vercel Cron Jobs free tier limits:** https://vercel.com/docs/cron-jobs — confirm minimum interval
7. **shadcn/ui Calendar component:** https://ui.shadcn.com/docs/components/calendar
8. **Resend free tier:** https://resend.com/pricing — confirm 3k/mo, 100/day

All *library choices* above are based on pre-2026 ecosystem patterns that were already stable; *version numbers* should be verified at install time as noted. Flag any spot-check that contradicts a recommendation back to roadmap creation.
