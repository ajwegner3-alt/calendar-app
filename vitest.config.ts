import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
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
