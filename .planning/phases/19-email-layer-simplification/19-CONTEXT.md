# Phase 19: Email Layer Simplification - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor the email rendering layer to drop deprecated branding fields. `EmailBranding` collapses to `{ name, logo_url, brand_primary }`. The `sidebarColor → brand_primary → DEFAULT` priority chain in `renderEmailBrandedHeader` simplifies to `brand_primary → DEFAULT`. All 6 transactional senders + 4 route/cron callers updated. Footer drops the `nsi-mark.png` `<img>` and renders text-only attribution.

Requirements: EMAIL-15, EMAIL-16, EMAIL-17, EMAIL-18, EMAIL-19, EMAIL-20.

Out of scope: web-side branding (Phase 17/18 territory), email QA on multiple clients (deferred to v1.3 marathon QA), schema DROP (Phase 21).

</domain>

<decisions>
## Implementation Decisions

### Footer attribution ("Powered by North Star Integrations")
- **Linked, not plain text.** Anchor wraps the full phrase, target = `https://northstarintegrations.com` (no UTM tracking — keep simple).
- **Muted gray color: `#9ca3af`** (Tailwind `text-gray-400` equivalent). Matches the web `PoweredByNsi` component established in Phase 17.
- **No `nsi-mark.png` `<img>`.** EMAIL-19 explicitly removes it — pure text + link only.
- **Claude's discretion:** alignment (center vs left), whether to add a thin `<hr>` / `border-top` separator above the footer, exact font-size and `<table>`/inline-style markup for email-client safety.

### Default fallback color (when `brand_primary` is null)
- **Switch to NSI blue `#3B82F6`** (was legacy navy `#0A2540`). New accounts without a configured `brand_primary` get an NSI-styled email header band.
- **Important divergence from web reader:** `lib/branding/read-branding.ts` exports `DEFAULT_BRAND_PRIMARY = "#0A2540"` for legacy data integrity (Phase 18 lock). The email layer's default is intentionally different. Do NOT unify them — they serve different purposes (web reader fallback for legacy null rows vs. email rendering default).
- **Claude's discretion:** where to put the new email-side default constant (reuse from `read-branding.ts`, define locally in `lib/email/branding-blocks.ts`, or add a new `EMAIL_DEFAULT_BRAND_PRIMARY` export). Pick the option with cleanest import graph.

### EmailBranding interface migration
- **Final shape:** `{ name: string; logo_url: string | null; brand_primary: string | null }`. Drop `sidebarColor`, `backgroundColor`, `chromeTintIntensity`.
- **Claude's discretion:** hard removal vs. Phase 18-style `@deprecated` optional shim. Recommend hard removal if the call-graph is small enough to update atomically (it is — 10 files). Phase 18's shim was needed because `chrome-tint.ts` + its test would have broken; verify no analogous external consumer exists before deciding.
- **Claude's discretion:** keep `renderEmailBrandedHeader` name vs. rename to `renderEmailHeader`. Lean toward keep — name still accurate (header is brand-colored), and rename adds churn across 6 sender import sites for negligible clarity gain.
- **Claude's discretion:** add `emailBrandingFromRow(account)` helper in `lib/branding/read-branding.ts` (mirrors existing `brandingFromRow` pattern) vs. inline construction at each of the 4 callers. Helper is preferred if SELECT shape is repeated; inline is fine if each caller already has its own `account` object.

### Null-logo handling in header band
- **Claude's discretion:** preserve current rendering (likely renders `branding.name` as plain text inside the band) unless EMAIL-15..20 spec demands a change. Do not introduce the public-page initial-circle pattern unless current code already does it — email-client CSS for circles is fragile.

### Light-color contrast handling
- **Claude's discretion:** Phase 19 is not required to add contrast handling. The Phase 18 BrandingEditor already warns the user (`lib/branding/contrast.ts` luminance > 0.85). If existing email code has no contrast guard, Phase 19 doesn't add one. If it does, preserve.

### Test fixture strategy
- **Claude's discretion:** `tests/email-branded-header.test.ts` currently asserts the `sidebar_color` priority chain. Recommend updating fixtures + assertions to validate the new `brand_primary → DEFAULT` resolution rather than deleting (test still has value). If the priority chain is the only thing it tests and the new logic is trivial, deletion is acceptable — Phase 20 (CLEAN-04..06) is already deleting deprecated tests, so adding this one to that bucket is a valid alternative.

### Deploy + verification strategy
- **Claude's discretion:** atomic single-PR (recommended for tight 10-file scope; CP-02 pitfall says atomic) vs. Phase 18-style types-first wave split. Pick atomic unless the planner finds a reason to split.
- **Claude's discretion:** smoke test scope on Vercel preview. ROADMAP success criterion #1 demands at minimum: Andrew books a test slot on NSI account, receives confirmation email with `#3B82F6` header band + text-only footer with link. Broader coverage (all 6 senders, multiple email clients) is a nice-to-have, not required.
- **Claude's discretion:** pre-flight gates. Recommend BOTH `tsc --noEmit` clean AND grep for `sidebarColor`/`backgroundColor`/`chromeTintIntensity`/`sidebar_color`/`background_color`/`chrome_tint_intensity` returning zero hits across `lib/email/`, sender files, and 4 caller files before merge.

### Plain-text alternatives (EMAIL-20)
- **Locked from spec:** booker-facing senders (confirmation, cancel-booker, reschedule-booker) keep their plain-text alternatives. Phase 19 must not regress these. No new decisions here — verification step only.

</decisions>

<specifics>
## Specific Ideas

- **Footer pattern reference:** match the web `PoweredByNsi` component (Phase 17) in spirit — muted gray, attribution to NSI, link to homepage. Email-client constraints (no flexbox, table-based layout, inline styles) will dictate exact markup, but the visual intent is consistent across web + email.
- **NSI blue default rationale:** v1.2 milestone goal is "every customer-facing surface that doesn't have a configured brand defaults to NSI's identity." Email header band joins the owner shell, public surfaces (when account has no `brand_primary`), and embed in this pattern.
- **Atomic deploy preference:** PITFALLS.md CP-02 explicitly calls out `EmailBranding` as needing atomic change. Plan-checker should hold the line on this unless wave-split has a clear reason.

</specifics>

<deferred>
## Deferred Ideas

- **UTM tracking on footer link** (`?utm_source=email&utm_medium=transactional&utm_campaign=powered_by`) — out of scope for v1.2; would belong with v1.3 marketing instrumentation work.
- **Email-client matrix QA** (Outlook, Apple Mail, Gmail mobile, etc.) — defer to v1.3 marathon QA bucket (already deferred per ROADMAP). Phase 19 visual gate is Andrew + Gmail web only unless planner specifies otherwise.
- **Initial-circle pattern in email header band** (when `logo_url` is null) — would mirror public `PublicHeader` pill. Email-client CSS support for `border-radius: 50%` on a `<table>` cell is workable but has edge cases. Park as a future polish item; current text-name fallback is acceptable.
- **Contrast guard in email render** (luminance > 0.85 → fall back to default) — would bring email parity with `PublicShell.resolveGlowColor`. Not required by EMAIL-15..20; revisit if a customer reports an unreadable email.

</deferred>

---

*Phase: 19-email-layer-simplification*
*Context gathered: 2026-05-01*
