// ESLint flat config for Next.js 16 + ESLint 9.
//
// eslint-config-next 16.x ships native flat configs (CommonJS modules that
// export an array of flat config objects). We import them directly and
// concat — no FlatCompat shim needed.
//
// Plan 08-02 background: prior config used `FlatCompat.extends()` to bridge
// the legacy preset surface, but that path triggered a circular-JSON crash
// inside @eslint/eslintrc's ConfigValidator on this codebase. Since the
// next-config-next 16 entry points are already flat, the shim is dead weight
// AND the source of the crash. Direct imports fix both problems.

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Plan 09-01: honor underscore-prefixed names as intentional-unused for
    // both args (mock fns, test dest-arg holes) and caught errors. Clears 6
    // warnings in tests/__mocks__ + tests without touching the test files.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "supabase/migrations/**",
      ".planning/**",
      ".playwright-mcp/**",
      "tmp/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
