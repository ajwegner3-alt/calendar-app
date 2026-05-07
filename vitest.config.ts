import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: [
      // `server-only` throws unconditionally in plain Node (Vitest) environments.
      // Route handlers that import it (e.g. lib/supabase/admin.ts) would fail to
      // load in tests. Map it to a no-op so the import succeeds in Vitest — the
      // safety guarantee (bundle-time error in client components) is irrelevant
      // in a Node test runner context. See tests/__mocks__/server-only.ts.
      {
        find: "server-only",
        replacement: path.resolve(__dirname, "tests/__mocks__/server-only.ts"),
      },

      // Turnstile mock — intercepts verifyTurnstile() so tests don't hit
      // the real Cloudflare siteverify endpoint. Per-test control via
      // __setTurnstileResult(). Plan 04-06 STATE.md lock: use path.resolve
      // (NOT new URL().pathname) — Windows spaces encode as %20 and break
      // module resolution.
      {
        find: "@/lib/turnstile",
        replacement: path.resolve(__dirname, "tests/__mocks__/turnstile.ts"),
      },

      // Email-sender mock — intercepts sendEmail() called by
      // send-booking-confirmation.ts + send-owner-notification.ts so no
      // real Gmail SMTP calls are made in tests. Spy via __mockSendCalls.
      //
      // Phase 32 (Plan 32-03 deviation): switched from string-prefix alias to
      // exact regex match. The previous string form was a prefix replacement,
      // so `@/lib/email-sender/quota-guard` was incorrectly rewritten to
      // `tests/__mocks__/email-sender.ts/quota-guard` and module resolution
      // failed. The regex pins the alias to the bare specifier only;
      // sub-paths (`@/lib/email-sender/quota-guard`, `@/lib/email-sender/types`)
      // pass through to the tsconfig path resolver as intended.
      {
        find: /^@\/lib\/email-sender$/,
        replacement: path.resolve(__dirname, "tests/__mocks__/email-sender.ts"),
      },

      // Account-sender mock — intercepts getSenderForAccount() used by all
      // 5 leaf senders after the Phase 35 cutover. The stub EmailClient's
      // .send() pushes to the same __mockSendCalls array as the email-sender
      // mock above so existing integration tests (cancel-reschedule-api,
      // reminder-cron, bookings-api) continue to work without modification.
      //
      // Pinned to exact specifier only (the real quota-guard/types sub-paths
      // are NOT intercepted — same pattern as the email-sender alias above).
      {
        find: /^@\/lib\/email-sender\/account-sender$/,
        replacement: path.resolve(__dirname, "tests/__mocks__/account-sender.ts"),
      },
    ],
  },
  test: {
    // Default env jsdom for component tests; override per-file for DB tests.
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Sequential by default is fine; DB tests can opt into threading but
    // race test intentionally runs concurrent INSERTs INSIDE a single test.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 15_000, // DB round-trips to remote Supabase can be slow
  },
});
