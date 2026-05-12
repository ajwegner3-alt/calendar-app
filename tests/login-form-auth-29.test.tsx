/**
 * Phase 45 Plan 45-03 Task 1 — AUTH-29 byte-identical helper line invariant.
 *
 * Locks the v1.7 four-way enumeration-safety contract:
 *   - Known email     → action returns { success: true }
 *   - Unknown email   → action returns { success: true } (4xx swallowed; actions.ts L182)
 *   - Rate-limited    → action returns { success: true } (silent throttle; actions.ts L148)
 *   - OTP cooldown    → action returns { success: true } (4xx swallowed; actions.ts L173-179)
 *
 * All four states emit the SAME { success: true } shape from the action — that is
 * the foundation. This test file locks the *helper line* (the inline `<p>` we
 * added in Plan 45-03) to ensure it is byte-identical regardless of any
 * client-side state and is properly absent from the success view (where
 * MagicLinkSuccess takes over the whole DOM).
 *
 * Per RESEARCH P1: the helper MUST be a literal string with zero state references
 * and zero state-dependent attributes (no aria-live, no conditional className).
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Radix Tabs (Radix UI in general) calls hasPointerCapture / releasePointerCapture
// inside its tab-trigger pointerdown handler. jsdom does not implement these
// methods on Element, so the call throws and the activation never completes
// (the tab visually does not switch in tests). Polyfill before any render.
beforeAll(() => {
  if (typeof window !== "undefined") {
    if (!Element.prototype.hasPointerCapture) {
Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.releasePointerCapture) {
Element.prototype.releasePointerCapture = () => {};
    }
    if (!Element.prototype.setPointerCapture) {
Element.prototype.setPointerCapture = () => {};
    }
    if (!Element.prototype.scrollIntoView) {
Element.prototype.scrollIntoView = () => {};
    }
    if (!window.matchMedia) {
window.matchMedia = (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      });
    }
  }
});

// --- Mocks (vi.hoisted to avoid TDZ with factory hoisting) -----------------

const { mockLoginAction, mockRequestMagicLinkAction, mockInitiateGoogleOAuthAction } =
  vi.hoisted(() => ({
    mockLoginAction: vi.fn(async () => ({})),
    mockRequestMagicLinkAction: vi.fn(async () => ({ success: true })),
    mockInitiateGoogleOAuthAction: vi.fn(async () => {}),
  }));

vi.mock("@/app/(auth)/app/login/actions", () => ({
  loginAction: mockLoginAction,
  requestMagicLinkAction: mockRequestMagicLinkAction,
  initiateGoogleOAuthAction: mockInitiateGoogleOAuthAction,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

// Now import the component under test (after mocks are wired)
import { LoginForm } from "@/app/(auth)/app/login/login-form";

const HELPER_TEXT =
  "We'll email you a one-time sign-in link. Open it on this device to log in.";

beforeEach(() => {
  mockLoginAction.mockReset().mockResolvedValue({});
  mockRequestMagicLinkAction.mockReset().mockResolvedValue({ success: true });
  mockInitiateGoogleOAuthAction.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

async function switchToMagicLinkTab() {
  const tab = await screen.findByRole("tab", { name: /magic link/i });
  // Radix Tabs activates on pointerdown (with button=0). fireEvent.click alone
  // does not trigger the activation because Radix listens to pointerdown.
  fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
  // Wait for the magic-link content to mount.
  await screen.findByTestId("magic-link-helper");
}

describe("AUTH-29 byte-identical helper line", () => {
  it("helper line renders with exact byte-identical copy on initial magic-link tab render", async () => {
    render(<LoginForm />);
    await switchToMagicLinkTab();

    const helper = await screen.findByTestId("magic-link-helper");
    expect(helper.textContent).toBe(HELPER_TEXT);
  });

  it("helper line copy does not change when the email field has a value", async () => {
    render(<LoginForm />);
    await switchToMagicLinkTab();

    const emailInput = await screen.findByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: "user@example.com" } });

    const helper = screen.getByTestId("magic-link-helper");
    expect(helper.textContent).toBe(HELPER_TEXT);
  });

  it("helper line is absent in MagicLinkSuccess view (success state replaces entire form)", async () => {
    // The action ALREADY returns { success: true } across all four AUTH-29
    // states (known/unknown/rate-limited/cooldown). Submitting flips the
    // magic-link tab to MagicLinkSuccess, which has its own AUTH-29-safe copy.
    mockRequestMagicLinkAction.mockResolvedValue({ success: true });

    render(<LoginForm />);
    await switchToMagicLinkTab();

    const emailInput = await screen.findByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: "user@example.com" } });

    const submit = screen.getByRole("button", { name: /send login link/i });
    fireEvent.click(submit);

    // Wait for MagicLinkSuccess to take over.
    await waitFor(() => {
      expect(screen.queryByTestId("magic-link-helper")).toBeNull();
    });
  });

  it("helper line element has no state-dependent attributes (no aria-live, no conditional class)", async () => {
    render(<LoginForm />);
    await switchToMagicLinkTab();

    const helper = await screen.findByTestId("magic-link-helper");
    expect(helper.getAttribute("aria-live")).toBeNull();
    expect(helper.className).toBe("text-xs text-muted-foreground");
  });
});
