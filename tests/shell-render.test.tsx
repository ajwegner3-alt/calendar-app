/**
 * Phase 8 Plan 08-08 — Shell render harness (closes STATE.md backlog item
 * line 235: "render-test harness for shell layout — would have caught the
 * TooltipProvider regression in Plan 02-04 at CI instead of user smoke").
 *
 * SCOPE TRADEOFF (documented per plan instruction):
 * `app/(shell)/layout.tsx` (`ShellLayout`) is an async Server Component that
 * calls `createClient()` (Supabase server cookies()), `getClaims()`, and
 * `cookies()` from `next/headers` — all of which require a Next request
 * scope that jsdom + RTL do not provide. Rendering the real ShellLayout in
 * jsdom is impractical; a full mock surface (cookies, supabase server, auth)
 * would be brittle and large.
 *
 * Instead, this harness asserts the PROVIDERS TREE that ShellLayout
 * constructs at the root of the dashboard (`<TooltipProvider><SidebarProvider>
 * <AppSidebar/><SidebarInset>...children...</SidebarInset></SidebarProvider>
 * </TooltipProvider>`). The Plan 02-04 regression was a missing
 * TooltipProvider — a child component using `<Tooltip>` threw at render with
 * "Tooltip must be used within TooltipProvider". This harness reconstructs
 * the providers exactly as the layout assembles them and renders a
 * Tooltip-using child to prove the provider chain is intact.
 *
 * If a future change to ShellLayout removes TooltipProvider, this test will
 * NOT catch it directly (the harness uses its own assembly). To prevent
 * silent drift, the harness also imports the layout source at module level
 * and a separate test asserts that `app/(shell)/layout.tsx` contains the
 * literal "TooltipProvider" — a static-analysis guard against regression.
 *
 * Together these provide:
 *   1. Runtime proof: a Tooltip-using child mounts inside the layout's
 *      provider tree without throwing.
 *   2. Source-shape proof: ShellLayout's source still mentions
 *      TooltipProvider (catches a future delete-by-mistake).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// jsdom does not ship `window.matchMedia`, but the SidebarProvider tree
// uses the `useIsMobile` hook (which calls matchMedia) during mount. Polyfill
// at the top of this file with a minimal stub before any render happens.
// (Scoped to this test file — `tests/setup.ts` is intentionally untouched
// to avoid side-effects on DB-only test files that run with the `node`
// environment.)
beforeAll(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
});

import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

describe("ShellLayout providers harness (Phase 8 — TooltipProvider regression guard)", () => {
  it("renders without crashing when wrapping arbitrary children", () => {
    const { container } = render(
      <TooltipProvider delayDuration={0}>
        <SidebarProvider defaultOpen={true}>
          <SidebarInset>
            <div data-testid="content">test content</div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>,
    );
    expect(
      container.querySelector('[data-testid="content"]'),
    ).toBeInTheDocument();
  });

  it("provides TooltipProvider context for descendants using <Tooltip>", () => {
    // The Plan 02-04 regression was: shell mounted <SidebarProvider> WITHOUT
    // wrapping it in <TooltipProvider>. Any child using Radix Tooltip threw
    // at render with "Tooltip must be used within TooltipProvider". This
    // test renders that exact scenario inside the providers chain — must
    // NOT throw.
    const TooltipChild = () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <button data-testid="tooltip-trigger">trigger</button>
        </TooltipTrigger>
        <TooltipContent>tip</TooltipContent>
      </Tooltip>
    );

    expect(() => {
      render(
        <TooltipProvider delayDuration={0}>
          <SidebarProvider defaultOpen={true}>
            <SidebarInset>
              <TooltipChild />
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>,
      );
    }).not.toThrow();

    expect(
      document.querySelector('[data-testid="tooltip-trigger"]'),
    ).toBeTruthy();
  });

  it("source-shape guard: ShellLayout still mounts TooltipProvider", () => {
    // Static-analysis guard against silent removal of TooltipProvider from
    // the actual layout. Reads app/(shell)/layout.tsx as text and asserts
    // the literal exists. If a future PR deletes TooltipProvider from the
    // layout, this fails at CI before the runtime regression reaches a user.
    const layoutPath = resolve(__dirname, "..", "app", "(shell)", "layout.tsx");
    const source = readFileSync(layoutPath, "utf-8");
    expect(source).toMatch(/TooltipProvider/);
    expect(source).toMatch(/SidebarProvider/);
  });
});
