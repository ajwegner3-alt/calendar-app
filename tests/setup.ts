// Loaded once per test file. Wire env vars for tests.
import { config } from "dotenv";
import { vi } from "vitest";
config({ path: ".env.local" });
config({ path: ".env.test.local", override: true }); // optional overrides

// next/server `after()` requires a Next.js request scope (Route Handler /
// Server Action / Middleware) — calling it from raw Vitest invocations of
// POST(req) throws "after was called outside a request scope". Plan 08-02
// migrated `void sendXxxEmails(...)` fire-and-forget patterns to
// `after(() => sendXxxEmails(...))`; preserve the test-time semantics by
// stubbing `after()` to invoke the callback as a microtask.
//
// The existing 100ms `await new Promise(r => setTimeout(r, 100))` waits in
// the email-mocked tests still drain these microtasks, so __mockSendCalls
// assertions continue to work without per-test changes.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (callback: () => unknown | Promise<unknown>) => {
      // Schedule on the microtask queue so the calling function returns first
      // (mirrors production semantics: "run after the response is flushed").
      queueMicrotask(() => {
        try {
          const result = callback();
          if (result && typeof (result as Promise<unknown>).then === "function") {
            (result as Promise<unknown>).catch((err) => {
              // Match production behavior: errors from after() callbacks are
              // logged but do not propagate — the response was already sent.
              console.error("[test] after() callback rejected:", err);
            });
          }
        } catch (err) {
          console.error("[test] after() callback threw:", err);
        }
      });
    },
  };
});
