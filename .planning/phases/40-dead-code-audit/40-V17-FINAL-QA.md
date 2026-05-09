# Phase 40: Final v1.7 Production QA

**Production URL:** https://booking.nsintegrations.com
**Run date:** 2026-05-09
**Performed by:** Andrew
**Pre-flight:** All Plans 40-03 through 40-07 deployed to production

---

## Phase 38: Magic-Link Auth Regressions

### A. Magic-link enumeration safety
**What to test:** Submit magic-link form on `/app/login` with (1) a real registered email and (2) a never-registered email. Both must produce identical UI (success message), no error surfaced for unknown email.
**Expected:** Identical responses — neither reveals account existence.
**Result:** PASS
**Notes:** UI parity confirmed by Andrew on production. Backend silence confirmed via Supabase MCP query: zero new rows in `auth.users` and zero tokens in `auth.one_time_tokens` for the unknown email; only the real account (`ajwegner3@gmail.com`) received a token. `shouldCreateUser:false` + the 5xx-only `formError` gate (Plan 38-01 LD) held end-to-end.

### B. 5/hr/IP+email rate-limit silently throttles
**What to test:** Submit magic-link form 6+ times with the same email within an hour. The 6th+ attempt must return success UI silently (no 429 error surfaced).
**Expected:** No surfaced error; bucket exhausts internally; user sees identical success.
**Result:** PASS
**Notes:** Andrew live-verified on production.

### C. Supabase ~60s inner cooldown
**What to test:** Submit magic-link 2-3 times within 60s. Note delivery: only 1-2 emails actually arrive due to Supabase's per-email cooldown. UI is still success.
**Expected:** Feature, not bug. Strengthens enumeration-safety contract.
**Result:** PASS
**Notes:** Andrew live-verified on production.

### D. End-to-end magic-link delivery + Site URL correctness
**What to test:** Submit magic-link with a real email, click the link in the delivered email. Confirm CTA link points to `https://booking.nsintegrations.com` (NOT localhost). Confirm sign-in completes and lands on the post-auth page.
**Expected:** CTA URL is the production domain; clicking it logs the user in.
**Result:** PASS
**Notes:** Andrew live-verified on production.

---

## Phase 39: BOOKER Polish Regressions

### A. 220ms fade+rise animation on first slot pick (CLS = 0)
**What to test:** On a public event page (e.g., `https://booking.nsintegrations.com/nsi/<slug>`), pick a date, then pick a time slot. The booking form column should fade in + rise ~220ms. Open Chrome DevTools Performance panel and verify CLS = 0.0 during the animation.
**Expected:** Smooth animation; CLS = 0.
**Result:** PASS
**Notes:** Andrew live-verified on production.

### B. Static skeleton renders pre-pick (desktop + mobile)
**What to test:** Land on the public event page. Pick a date but NO time slot yet. Confirm the form column shows the static `BookingFormSkeleton` (8 shape-only `bg-muted` blocks) — NOT a loading spinner, NOT empty white space, NOT pulsing animation. Test both desktop (>=1024px) and mobile (<768px).
**Expected:** Static placeholder visible on both viewports.
**Result:** PASS
**Notes:** Andrew live-verified on production.

### C. prefers-reduced-motion suppresses animation cleanly
**What to test:** Enable OS reduced-motion (Windows: Settings → Accessibility → Visual effects → Animation effects OFF; macOS: System Settings → Accessibility → Display → Reduce Motion). Reload the page, pick a slot. The form should appear immediately with NO animation.
**Expected:** Form shows instantly when motion is reduced; no transition.
**Result:** PASS
**Notes:** Andrew live-verified on production.

### Bonus regression: V15-MP-05 Turnstile lifecycle lock + RHF persistence
**What to test:** On a slot-picked form, type in name + email, then pick a DIFFERENT slot on the same date. Form should NOT remount (typed values persist, Turnstile token persists). Then change the DATE — form SHOULD unmount (this is by design for V15-MP-05).
**Expected:** Same-date re-pick: persists. Date change: unmounts.
**Result:** PASS
**Notes:** Andrew live-verified on production.

---

## Sign-off

- [x] All Phase 38 A-D rows PASS
- [x] All Phase 39 A-C rows PASS (+ bonus V15-MP-05 regression)
- [x] Andrew: Andrew Wegner — 2026-05-09

---

## Decision

- [x] PROCEED — All regressions PASS. v1.7 ready to close (Plan 09: `/gsd:complete-milestone`).
- [ ] BLOCK — One or more regressions FAIL. Investigation required before milestone close. (Failure → spawn a gap-closure phase or revert offending commit.)
