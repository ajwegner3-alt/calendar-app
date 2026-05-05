# Requirements: Calendar App (NSI Booking Tool) — v1.5

**Defined:** 2026-05-03
**Milestone:** v1.5 Buffer Fix + Audience Rebrand + Booker Redesign
**Core Value (from PROJECT.md):** A visitor lands on a service-based business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

## v1.5 Requirements

14 requirements across 3 categories. All map to phases in ROADMAP.md.

### Per-Event-Type Buffer (BUFFER)

Replaces account-wide `buffer_minutes` with per-event-type `buffer_after_minutes` (post-event only). Existing column reused (no ADD COLUMN). Two-step CP-03 deploy protocol drops `accounts.buffer_minutes`.

- [x] **BUFFER-01**: Owner can set a post-event buffer (in minutes) on each event type via the event-type editor (range: 0-360, step: 5, default: 0)
- [x] **BUFFER-02**: Slot engine (`computeSlots` / `slotConflictsWithBookings`) reads `event_types.buffer_after_minutes` per booking instead of `accounts.buffer_minutes` (asymmetric semantics: only the existing booking's post-buffer extends its blocked window)
- [x] **BUFFER-03**: Existing event types are backfilled with their account's current `buffer_minutes` value at migration time (no behavior change on day-1 for existing accounts)
- [x] **BUFFER-04**: `accounts.buffer_minutes` column is dropped from production Postgres via two-step CP-03 deploy protocol (30-min Vercel function drain between code-deploy and DROP migration)
- [x] **BUFFER-05**: Account-level buffer control is removed from the availability settings page; per-event-type buffer is the sole owner-facing control
- [x] **BUFFER-06**: Cross-event-type adjacency works correctly when one event type has buffer=0 and another has buffer>0 (verified via pg-driver test or smoke checkpoint)

### Audience Rebrand (BRAND)

Owner-facing copy changes across signup, onboarding, dashboard, settings, and developer-facing docs. Zero TypeScript identifier renames needed (research confirmed no `tradeContractor*` / `contractor*` symbols exist). Booker-facing surfaces and transactional emails are explicitly OUT OF SCOPE for this rebrand.

- [x] **BRAND-01**: Owner-facing surfaces (signup hero, onboarding wizard copy, dashboard headings, settings copy, event-type editor placeholders) reference "service-based businesses" or generic framing instead of "trade contractors"
- [x] **BRAND-02**: README.md and FUTURE_DIRECTIONS.md (project-root, not archived `.planning/milestones/`) reference "service-based businesses"
- [x] **BRAND-03**: Booker-facing surfaces (`/[account]/[event-slug]`, `/[account]` index, embed widget, all 6 transactional emails) remain audience-neutral (no NSI product copy added; existing copy unchanged)

### Public Booker 3-Column Redesign (BOOKER)

Refactor booking card from 2-column (calendar + form) to 3-column (calendar LEFT → time slots MIDDLE → form RIGHT) at `lg:` breakpoint. Form column reserves space at all times and reveals form content in-place after slot pick. Mobile collapses to single column (calendar → times → form). Embed widget inherits responsive breakpoint and naturally stays 2-column at iframe widths.

- [x] **BOOKER-01**: Public booking card displays a 3-column horizontal layout at `lg:` (1024px+): calendar LEFT, time slots MIDDLE, form RIGHT
- [x] **BOOKER-02**: Booker card uses `max-w-4xl` (was `max-w-3xl`) to accommodate 3-column content with breathing room
- [x] **BOOKER-03**: Form column is rendered with reserved width at all times; before slot pick, shows the prompt "Pick a time on the left to continue."; after slot pick, the booking form replaces the prompt in-place with NO layout shift (calendar and times columns do not reflow)
- [x] **BOOKER-04**: Mobile (below `lg:`) stacks vertically in DOM order: calendar → times → form
- [x] **BOOKER-05**: Andrew live-verifies the 3-column desktop layout on production at 1024px / 1280px / 1440px and the mobile stack on a real device

## Future Requirements (v1.6+)

Tracked but explicitly NOT in v1.5.

### Buffer

- **BUFFER-07** (v1.6+): Pre-event buffer (`buffer_before_minutes` — schema column already exists at default 0; computeSlots wiring deferred)
- **BUFFER-08** (v1.6+): Owner sees "15 min buffer" badge on event-type list card
- **BUFFER-09** (v1.6+): Configurable buffer step granularity (e.g., 1-min instead of 5-min)

### Brand

- **BRAND-04** (v2+): Industry/business-type segmentation question in onboarding (with schema, analytics, conditional UI)
- **BRAND-05** (v2+): Vertical-specific event-type templates (consultants, salons, fitness, healthcare, etc.)

### Booker

- **BOOKER-06** (v1.6+): Animated form slide-in (CSS translate-x transition on slot pick)
- **BOOKER-07** (v1.6+): Skeleton loader on slow `/api/slots` response (currently no loading state visible)

## Out of Scope

Explicitly excluded from v1.5. Reasoning prevents re-adding.

| Feature | Reason |
|---------|--------|
| Pre-event buffer (`buffer_before_minutes` wiring) | Andrew confirmed "no pre-event necessary at the moment" during questioning. Schema column exists at 0; safe to defer. |
| Buffer affects displayed end-time in booker UI | `end_at` stores raw booking window; changing it would break Phase 27 EXCLUDE constraint semantics + reschedule invariants. No leading tool shows buffer to invitees. |
| Industry segmentation question in onboarding | Requires schema, analytics, conditional UI — outside copy-only rebrand scope. Generic copy covers all verticals. |
| Audience copy on booker-facing surfaces | Booking pages, embed widget, and transactional emails stay brand-neutral (contractor's brand, not NSI product copy). |
| TypeScript identifier renames (e.g., `tradeContractor*` → `serviceBusiness*`) | Research confirmed zero such identifiers exist in the codebase. No-op. |
| Embed widget 3-column layout | Iframe widths often < 1024px; `lg:` breakpoint handles it natively. No embed-specific code branch. |
| Animated form slide-in on slot pick | Polish-only; basic in-place swap is table-stakes for v1.5. Defer to v1.6 polish pass. |
| Account-level buffer fallback after migration | Drop is clean; per-event buffer is the sole control. Owners who want global buffer set it on all event types. |
| Owner-facing buffer badge on event-type list | No user request; informational UI not load-bearing for v1.5 correctness. |
| Pre-flight buffer-column rename (`buffer_after_minutes` → `post_buffer_minutes`) | LD-01: reuse existing column; rename would be migration thrash with no behavior change. |

## Carryover Backlog (Deferred from v1.0–v1.4, NOT in v1.5)

These items remain in the carryover backlog. v1.5 does NOT execute them; they are tracked here for visibility only.

- Marathon QA execution (formally retired as deploy-and-eyeball model after 4 consecutive deferrals — operating model since v1.3)
- Resend migration (closes Gmail 200/day SMTP cap, ~$10/mo for 5k emails) — INFRA-01
- Vercel Pro hourly cron flip — INFRA-02
- OAuth signup — AUTH-23
- Magic-link login — AUTH-24
- NSI brand asset replacement (`public/nsi-mark.png` placeholder) — BRAND-22
- 7 DEBT items from v1.0–v1.2 carryover (DEBT-01..07)
- 3 deferred fragilities from Phase 26 audit (`bookings-table.tsx:37` unguarded TZDate; `queries.ts:92-94` undefined normalization; `queries.ts:86` unguarded throw)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUFFER-01 | Phase 28 | Complete |
| BUFFER-02 | Phase 28 | Complete |
| BUFFER-03 | Phase 28 | Complete |
| BUFFER-04 | Phase 28 | Complete |
| BUFFER-05 | Phase 28 | Complete |
| BUFFER-06 | Phase 28 | Complete |
| BRAND-01 | Phase 29 | Complete |
| BRAND-02 | Phase 29 | Complete |
| BRAND-03 | Phase 29 | Complete |
| BOOKER-01 | Phase 30 | Complete |
| BOOKER-02 | Phase 30 | Complete |
| BOOKER-03 | Phase 30 | Complete |
| BOOKER-04 | Phase 30 | Complete |
| BOOKER-05 | Phase 30 | Complete |

**Coverage:**
- v1.5 requirements: 14 total
- Mapped to phases: 14 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-05-03*
*Last updated: 2026-05-05 — Phase 30 complete; BOOKER-01..05 shipped; v1.5 milestone closed (14/14 requirements complete)*
