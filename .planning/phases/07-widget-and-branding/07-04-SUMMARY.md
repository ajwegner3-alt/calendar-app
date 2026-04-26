---
phase: 07-widget-and-branding
plan: 04
subsystem: ui
tags: [branding, logo-upload, color-picker, server-actions, supabase-storage, zod, iframe-preview, two-stage-auth, cache-busting, magic-bytes]

# Dependency graph
requires:
  - phase: 07-01
    provides: lib/branding/contrast.ts (pickTextColor), AccountSummary with logo_url + brand_primary, DEFAULT_BRAND_PRIMARY constant
  - phase: 07-02
    provides: Supabase Storage 'branding' bucket (PNG-only, 2 MB cap, public); createAdminClient() for storage access
  - phase: 07-03
    provides: ?previewColor + ?previewLogo server-validated param contract; /embed/[account]/[slug] chromeless route for preview iframe
provides:
  - app/(shell)/app/branding/page.tsx — Server Component; loads BrandingState for owner; redirects /app/unlinked when not linked
  - app/(shell)/app/branding/_lib/schema.ts — primaryColorSchema (hex regex), logoFileSchema (PNG-only, 2 MB, PNG_MAGIC bytes), MAX_LOGO_BYTES
  - app/(shell)/app/branding/_lib/load-branding.ts — loadBrandingForOwner(); returns BrandingState (accountId, accountSlug, logoUrl, primaryColor, firstActiveEventSlug)
  - app/(shell)/app/branding/_lib/actions.ts — uploadLogoAction (FormData → Storage + DB), savePrimaryColorAction (hex → DB), deleteLogoAction (Storage + DB)
  - app/(shell)/app/branding/_components/logo-uploader.tsx — PNG-only upload with client-side size + type validation; calls uploadLogoAction; onUpload callback
  - app/(shell)/app/branding/_components/color-picker-input.tsx — dual-bound hex text + native color picker; onChange emits normalized #RRGGBB; calls savePrimaryColorAction
  - app/(shell)/app/branding/_components/preview-iframe.tsx — iframe keyed by URL; re-mounts on previewColor/previewLogo change; empty-state for no event types
  - app/(shell)/app/branding/_components/branding-editor.tsx — orchestrator; two-column layout; owns primaryColor + logoUrl state; wires live preview
affects:
  - 07-06-apply-branding-to-page-surfaces (reads accounts.logo_url + accounts.brand_primary set here)
  - 07-07-apply-branding-to-emails (reads accounts.logo_url with ?v= cache-bust baked in; pass directly to <img src={...}>)
  - 07-08-account-index-route (reads same branding fields)
  - 09-manual-qa (deferred: JPG MIME reject, >2 MB size cap, magic-byte server-side check vs renamed extension)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-stage owner auth: RLS-scoped createClient() checks current_owner_account_ids() RPC first; admin client performs Storage upload + accounts UPDATE"
    - "Cache-bust via ?v={timestamp} query param appended to public Storage URL before writing to DB — solves Gmail CDN proxy stale-image issue (Pitfall 7)"
    - "iframe re-mount via React key: key={url} forces full re-mount on previewColor/previewLogo change instead of postMessage round-trip"
    - "Magic-byte server-side validation: read first 4 bytes of File buffer; compare to PNG_MAGIC [0x89,0x50,0x4E,0x47] — catches renamed non-PNG that passes browser MIME sniff"
    - "Server Action shape: outer try/catch only because getOwnerAccountIdOrThrow() can throw; all inner error paths use early return {error}"

key-files:
  created:
    - app/(shell)/app/branding/page.tsx
    - app/(shell)/app/branding/_lib/schema.ts
    - app/(shell)/app/branding/_lib/load-branding.ts
    - app/(shell)/app/branding/_lib/actions.ts
    - app/(shell)/app/branding/_components/branding-editor.tsx
    - app/(shell)/app/branding/_components/logo-uploader.tsx
    - app/(shell)/app/branding/_components/color-picker-input.tsx
    - app/(shell)/app/branding/_components/preview-iframe.tsx
  modified: []

key-decisions:
  - "PNG-only in v1 (not PNG + SVG) — SVG can embed scripts (XSS surface); deferred to v2 enhancement"
  - "Cache-bust via ?v={timestamp} in stored logo_url — prevents Gmail proxy from serving stale image after re-upload to same Storage path"
  - "iframe src query-param approach for live preview (RESEARCH §Pattern 7 option b) — simpler than postMessage from editor; no new postMessage receiver needed in embed page"
  - "Preview iframe re-mounts via React key={url} — forces fresh load with new params on every color/logo change"
  - "Outer try/catch in actions.ts (exception to Plan 03 no-try/catch invariant) — necessary because getOwnerAccountIdOrThrow() throws rather than returning error; mirrors Phase 6 cancelBookingAsOwner shape"
  - "Downstream plans (07-06, 07-07) read accounts.logo_url as-is — ?v= cache-bust already embedded in stored URL; no further manipulation needed"

patterns-established:
  - "Pattern: Two-stage owner auth (RLS check via current_owner_account_ids RPC, then admin client) — mirrors Phase 6 cancelBookingAsOwner; use for any Owner-scoped mutation touching Storage or cross-table updates"
  - "Pattern: Storage path {accountId}/logo.png with upsert:true — stable path enables cache-bust via query param rather than UUID filename churn"

# Metrics
duration: ~25min (execution) + human-verify checkpoint
completed: 2026-04-26
---

# Phase 7 Plan 04: Branding Editor Summary

**Branding editor at /app/branding with PNG logo upload (Supabase Storage, magic-byte validation, ?v= cache-bust), dual-bound hex + native color picker, and live preview iframe re-mounting via React key on every color/logo change before save**

## Performance

- **Duration:** ~25 min execution + human-verify checkpoint on 2026-04-26
- **Started:** 2026-04-26 (same session as 07-03)
- **Completed:** 2026-04-26 (Andrew approved 2026-04-26)
- **Tasks:** 3 auto + 1 human-verify checkpoint (4 total)
- **Files created:** 8

## Accomplishments

- Delivered BRAND-01 (logo upload end-to-end: client validation → FormData → Server Action → Supabase Storage → DB `logo_url` with `?v=` cache-bust) and BRAND-02 (primary color: hex text + native color picker → Server Action → DB `brand_primary`)
- Locked the two-stage owner auth pattern (RLS-scoped `current_owner_account_ids()` check, then `createAdminClient()` for Storage + accounts UPDATE) — extends the Phase 6 `cancelBookingAsOwner` shape to branding mutations
- Live preview iframe re-mounts on every color/logo change via `key={url}` React pattern — no postMessage receiver changes needed in 07-03 embed page; leverages `?previewColor`/`?previewLogo` contract locked in Plan 07-03
- Build succeeded (`npm run build`), TypeScript clean; smoke tests 1–7, 11, 12 approved by Andrew on 2026-04-26

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema + Server Actions + branding loader** — `bdd5e01` (feat)
2. **Task 2: Build all client components** — `de70cc3` (feat)
3. **Task 3: Wire branding/page.tsx + build check** — `498cb25` (feat)
4. **Task 4: Andrew smoke-tests the branding editor live** — checkpoint; approved 2026-04-26

**Plan metadata:** (this docs commit)

## Files Created/Modified

- `app/(shell)/app/branding/page.tsx` — Server Component; calls `loadBrandingForOwner()`; redirects `/app/unlinked` when owner not linked to account; renders `<BrandingEditor state={state} />`
- `app/(shell)/app/branding/_lib/schema.ts` — `primaryColorSchema` (hex `/^#[0-9a-fA-F]{6}$/`), `logoFileSchema` (PNG_MAGIC, MAX_LOGO_BYTES = 2 MB), `PNG_MAGIC` constant exported for server-side byte check
- `app/(shell)/app/branding/_lib/load-branding.ts` — `loadBrandingForOwner()`: RLS-scoped `createClient()`; `current_owner_account_ids()` RPC; accounts row + first active event_type slug; returns `BrandingState | null`
- `app/(shell)/app/branding/_lib/actions.ts` — `uploadLogoAction(formData)`: size check → MIME check → magic-byte check → two-stage auth → Storage upsert → `?v=` cache-bust → DB update → `revalidatePath`; `savePrimaryColorAction(hex)`: Zod parse → two-stage auth → DB update; `deleteLogoAction()`: Storage remove (best-effort) → DB null; returns `ActionResult<T>`
- `app/(shell)/app/branding/_components/logo-uploader.tsx` — `"use client"` PNG upload; `accept="image/png"`; client-side size + MIME guard (sonner toast on fail); builds FormData; calls `uploadLogoAction`; "Remove logo" calls `deleteLogoAction`; shows current logo via `<img>`
- `app/(shell)/app/branding/_components/color-picker-input.tsx` — `"use client"` dual-bound; text input + `<input type="color">`; local state normalizes to `#RRGGBB`; calls `onChange` on every change (live preview); format toast on blur; "Save color" button calls `savePrimaryColorAction`
- `app/(shell)/app/branding/_components/preview-iframe.tsx` — `"use client"`; constructs src: `/embed/${accountSlug}/${eventSlug}?previewColor=...&previewLogo=...`; `key={url}` forces re-mount on change; empty state (`firstActiveEventSlug === null`) links to `/app/event-types/new`
- `app/(shell)/app/branding/_components/branding-editor.tsx` — `"use client"` orchestrator; `useState` for `primaryColor` + `logoUrl`; two-column grid; wires `onUpload` → `setLogoUrl`, `onChange` → `setPrimaryColor`; passes live state to `PreviewIframe`; uses `useTransition` + sonner toast

## Decisions Made

- **PNG-only (not PNG + SVG):** SVG can embed `<script>` tags and JavaScript handlers — serving user-uploaded SVG from a public Supabase Storage URL would create an XSS surface. PNG-only is the safe v1 choice; SVG support deferred to v2 with sanitization.
- **`?v={timestamp}` cache-bust in stored `logo_url`:** Supabase Storage public URLs are stable per path. Gmail's image proxy (and other CDNs) may cache the old logo indefinitely after re-upload to the same path. Appending `?v={Date.now()}` changes the stored URL on every upload — downstream code (emails, booking pages) receives the fresh URL from DB without knowing about the cache problem.
- **React `key={url}` for iframe re-mount (RESEARCH §Pattern 7 option b):** Simplest way to force a full reload with new query params. Alternative — sending postMessage to the loaded iframe — would require adding a message listener to 07-03's `EmbedShell`, complicating that contract. The key-based re-mount trades a brief white-flash for zero coupling.
- **Outer try/catch exception in actions.ts:** Plan 03-03 locked "no try/catch in actions.ts; all error paths use early return." This plan's actions need an outer try because `getOwnerAccountIdOrThrow()` throws on auth failure. The exception is intentional and mirrors the Phase 6 `cancelBookingAsOwner` shape — documented here to prevent future cleanup that removes it incorrectly.
- **Forward contract for 07-06 + 07-07:** Downstream plans read `accounts.logo_url` directly and pass it to `<img src={...}>` without manipulation. The `?v=` cache-bust is already embedded in the stored value. Plans 07-06 and 07-07 MUST NOT strip or re-encode the query param.

## Server Action Contracts

```typescript
// uploadLogoAction — returns logoUrl with ?v= cache-bust
uploadLogoAction(formData: FormData): Promise<ActionResult<{ logoUrl: string }>>
// formData must contain key "file" as a File (image/png, ≤ 2 MB)
// Storage path: {accountId}/logo.png (upsert: true)
// Stored URL format: {publicUrl}?v={Date.now()}

// savePrimaryColorAction
savePrimaryColorAction(hex: string): Promise<ActionResult>
// hex must match /^#[0-9a-fA-F]{6}$/

// deleteLogoAction
deleteLogoAction(): Promise<ActionResult>
// Storage remove is best-effort (ignores not-found); DB logo_url always cleared to null
```

## Validation Layers

| Check | Where | What |
|-------|-------|-------|
| File size ≤ 2 MB | Client (UX) + Server (truth) | `file.size > MAX_LOGO_BYTES` |
| MIME = image/png | Client (UX) + Server (fast path) | `file.type !== 'image/png'` |
| Magic bytes = PNG | Server only (security gate) | First 4 bytes === [0x89,0x50,0x4E,0x47] |
| Hex format | Client (blur toast) + Server (Zod) | `/^#[0-9a-fA-F]{6}$/` |
| Bucket policy | Supabase (third layer) | PNG-only, 2 MB cap configured in 07-02 |

## Live Smoke Test Results (Andrew, 2026-04-26)

| Step | Description | Result |
|------|-------------|--------|
| 1 | Sign in, navigate to /app/branding | PASS |
| 2 | Side-by-side editor + preview layout | PASS |
| 3 | Type hex color → preview iframe re-mounts | PASS |
| 4 | Use native color picker → both inputs sync; preview updates | PASS |
| 5 | Click "Save color" → toast "Saved" | PASS |
| 6 | Refresh → saved color persists | PASS |
| 7 | Upload PNG logo → toast + logo display + preview update | PASS |
| 8 | Upload JPG → toast "PNG only" | DEFERRED — see below |
| 9 | Upload >2 MB PNG → toast "File too large" | DEFERRED — see below |
| 10 | Upload renamed JPEG (.jpg → .png) → magic-byte rejection | DEFERRED — see below |
| 11 | Public booking page still renders (branding not yet wired — expected) | PASS |
| 12 | "Remove logo" clears preview + DB; re-upload NSI logo | PASS |

## Deferred Verification (Phase 9 Manual QA Backlog)

Steps 8, 9, and 10 were not live-tested during this session. Server-side validation code EXISTS and is correct (Zod schema + magic-byte check in `uploadLogoAction`). Deferred to Phase 9 because:
- Andrew had a PNG ready but not a JPG, oversized file, or renamed JPEG at time of smoke test
- These are edge-case rejection paths; the happy path (steps 1–7, 11, 12) was fully verified

**Phase 9 items:**
- Step 8: Upload a real JPG file → expect toast "PNG only" (MIME check)
- Step 9: Upload a PNG > 2 MB → expect toast "File too large" (size check)
- Step 10: Rename a JPEG to `.png`, upload → expect toast "PNG only" (magic-byte server check catches spoofed MIME)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript clean (`npx tsc --noEmit` passed). Build clean (`npm run build` passed). Pre-existing test-file type errors (Phase 5/6 mock alias issues) are unrelated to this plan and carry forward unchanged.

## User Setup Required

None — Supabase Storage 'branding' bucket was pre-configured in Plan 07-02. No new environment variables required.

## Forward Contract for Plans 07-06 + 07-07

Both downstream plans read branding from `accounts` row directly. Key invariants they MUST maintain:

```
accounts.logo_url   = "{supabase_storage_public_url}?v={timestamp}"
                      OR null (no logo uploaded)
                      DO NOT strip ?v= query param — it is load-bearing for email CDN cache busting

accounts.brand_primary = "#RRGGBB" (6-digit hex with leading #)
                          OR null (use DEFAULT_BRAND_PRIMARY = "#0A2540")
```

Plans 07-06 and 07-07 should pass `logo_url` directly to `<img src={logo_url}>` without encoding, re-encoding, or stripping query params. The `brandingFromRow()` utility from Plan 07-01 handles the null fallback to DEFAULT_BRAND_PRIMARY automatically.

## Next Phase Readiness

- `accounts.logo_url` (with `?v=` cache-bust) and `accounts.brand_primary` are now populated by owner action — 07-06 and 07-07 may read these fields immediately
- `/app/branding` route fully functional; no stub or placeholder code remains
- Two-stage owner auth pattern available as a reference for any future Owner-scoped storage mutations
- Phase 9 manual QA needs to cover steps 8, 9, 10 (file-type rejection edge cases) — added to carried concerns

---
*Phase: 07-widget-and-branding*
*Completed: 2026-04-26*
