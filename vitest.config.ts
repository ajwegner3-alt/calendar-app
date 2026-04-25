import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // `server-only` throws unconditionally in plain Node (Vitest) environments.
      // Route handlers that import it (e.g. lib/supabase/admin.ts) would fail to
      // load in tests. Map it to a no-op so the import succeeds in Vitest — the
      // safety guarantee (bundle-time error in client components) is irrelevant
      // in a Node test runner context. See tests/__mocks__/server-only.ts.
      "server-only": path.resolve(__dirname, "tests/__mocks__/server-only.ts"),
    },
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
