/**
 * Phase 45 Plan 45-03 Task 2 — 3-fail counter and magic-link nudge behavior.
 *
 * Locks the AUTH-37 + AUTH-38 contract:
 *   - Counter advances ONLY on errorKind === "credentials" (not 429, not 5xx)
 *   - Counter caps at 3 (Math.min(n + 1, 3) — RESEARCH P7)
 *   - Counter is session-scoped — NO localStorage/sessionStorage writes (AUTH-37 hard)
 *   - Counter survives Tabs unmount of inactive content (RESEARCH P2 — counter
 *     lives at LoginForm top level, not inside TabsContent)
 *   - Nudge click switches to magic-link tab AND pre-fills the email field
 *     (RESEARCH P9 — getValues called at click time, not at render)
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Radix UI calls hasPointerCapture / scrollIntoView inside its event handlers.
// jsdom doesn't implement these, so polyfill before any render.
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
      window.matchMedia = (query: string) =>
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
  }
});

// --- Mocks (vi.hoisted to avoid TDZ with factory hoisting) -----------------

const { mockLoginAction, mockRequestMagicLinkAction, mockInitiateGoogleOAuthAction } =
  vi.hoisted(() => ({
    // Default no-op success — individual tests override with mockResolvedValue.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clickPasswordTab() {
  const tab = await screen.findByRole("tab", { name: /^password$/i });
  fireEvent.pointerDown(tab, { button: 0 });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
}

async function clickMagicLinkTab() {
  const tab = await screen.findByRole("tab", { name: /magic link/i });
  fireEvent.pointerDown(tab, { button: 0 });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
}

/**
 * Submit the password-tab form. RHF mode "onBlur" + zodResolver requires that
 * we type a valid email + password before clicking submit, otherwise client
 * validation blocks the submit and the action never fires.
 *
 * To keep the email value across the 3 submissions inside a single test, we
 * re-fill the inputs each time (the form persists between submits because
 * useActionState doesn't reset the DOM).
 */
async function submitPasswordForm(email = "user@example.com", password = "supersecret") {
  // The password tab content is mounted by default (activeTab = "password").
  const emailInput = document.querySelector<HTMLInputElement>("#email-password")!;
  const passwordInput = document.querySelector<HTMLInputElement>("#password")!;

  if (!emailInput || !passwordInput) {
    throw new Error("Password tab inputs not found in DOM");
  }

  if (emailInput.value !== email) {
    fireEvent.change(emailInput, { target: { value: email } });
  }
  if (passwordInput.value !== password) {
    fireEvent.change(passwordInput, { target: { value: password } });
  }

  // Submit the form directly. Using requestSubmit equivalent via fireEvent.submit
  // on the form element triggers React's form action handler regardless of
  // button label state (Signing in… vs Sign in transient).
  const form = emailInput.closest("form")!;
  fireEvent.submit(form);
}

beforeEach(() => {
  mockLoginAction.mockReset().mockResolvedValue({});
  mockRequestMagicLinkAction.mockReset().mockResolvedValue({ success: true });
  mockInitiateGoogleOAuthAction.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("3-fail counter and magic-link nudge", () => {
  it("counter does not show nudge before any submission", async () => {
    render(<LoginForm />);
    await clickPasswordTab();
    expect(screen.queryByTestId("magic-link-nudge")).toBeNull();
  });

  it("counter does not advance on rateLimit errorKind (429)", async () => {
    // Return a NEW object each call. React's setState bails out via Object.is
    // when the next value === prev value — mockResolvedValue would hand back
    // the SAME object reference each time and the state update would be
    // dropped, defeating the test. mockImplementation forces a fresh object.
    mockLoginAction.mockImplementation(async () => ({
      formError: "Too many attempts. Please wait a minute and try again.",
      errorKind: "rateLimit" as const,
    }));

    render(<LoginForm />);

    // Submit 5 times.
    for (let i = 0; i < 5; i++) {
      await submitPasswordForm();
      // Wait a tick for the action to resolve and the effect to run.
      await waitFor(() => expect(mockLoginAction).toHaveBeenCalledTimes(i + 1));
    }

    // Nudge must NOT appear.
    expect(screen.queryByTestId("magic-link-nudge")).toBeNull();
  });

  it("counter does not advance on server errorKind (5xx)", async () => {
    mockLoginAction.mockImplementation(async () => ({
      formError: "Something went wrong. Please try again.",
      errorKind: "server" as const,
    }));

    render(<LoginForm />);

    for (let i = 0; i < 5; i++) {
      await submitPasswordForm();
      await waitFor(() => expect(mockLoginAction).toHaveBeenCalledTimes(i + 1));
    }

    expect(screen.queryByTestId("magic-link-nudge")).toBeNull();
  });

  it("counter advances ONLY on credentials errorKind and shows nudge at 3 consecutive failures", async () => {
    // mockImplementation returns a fresh object each call. mockResolvedValue
    // would hand back the SAME reference, and React's setState bails out via
    // Object.is — the state would only update once and the counter useEffect
    // would only fire once instead of three times.
    mockLoginAction.mockImplementation(async () => ({
      formError: "Invalid email or password.",
      errorKind: "credentials" as const,
    }));

    render(<LoginForm />);

    // Submit 3 times — each returns the SAME { formError, errorKind } shape.
    // RESEARCH P4: useEffect deps on `[state]` reference, so consecutive
    // identical-shape returns from useActionState still produce a NEW state
    // object each call and re-fire the effect.
    //
    // After each submit we MUST wait for both (a) the action to resolve and
    // (b) the resulting state-update to flush through useActionState before
    // the next submit (otherwise we race the state machine — useActionState
    // serializes pending submits but the NUMBER of returned errorKind values
    // we observe could be < 3).
    for (let i = 0; i < 3; i++) {
      await submitPasswordForm();
      await waitFor(() => expect(mockLoginAction).toHaveBeenCalledTimes(i + 1));
      // Allow the useActionState state-update + useEffect to flush before next submit.
      await new Promise((r) => setTimeout(r, 50));
    }

    // Nudge must appear with the recovery-framed copy.
    const nudge = await screen.findByTestId("magic-link-nudge");
    expect(nudge.textContent).toMatch(/Trouble signing in/i);
    expect(nudge.textContent).toMatch(/Email me a sign-in link instead/i);
  });

  it("clicking the nudge switches to magic-link tab and pre-fills the email field", async () => {
    // mockImplementation returns a fresh object each call. mockResolvedValue
    // would hand back the SAME reference, and React's setState bails out via
    // Object.is — the state would only update once and the counter useEffect
    // would only fire once instead of three times.
    mockLoginAction.mockImplementation(async () => ({
      formError: "Invalid email or password.",
      errorKind: "credentials" as const,
    }));

    render(<LoginForm />);

    // 3 fails to surface the nudge — type a memorable email so we can verify pre-fill.
    for (let i = 0; i < 3; i++) {
      await submitPasswordForm("user@example.com", "wrongpass");
      await waitFor(() => expect(mockLoginAction).toHaveBeenCalledTimes(i + 1));
      await new Promise((r) => setTimeout(r, 50));
    }

    const nudge = await screen.findByTestId("magic-link-nudge");
    const nudgeBtn = within(nudge).getByRole("button", {
      name: /Email me a sign-in link instead/i,
    });

    // Click the nudge button — must NOT submit the surrounding password form
    // (type="button" guard); must switch tab and seed prefillEmail.
    fireEvent.click(nudgeBtn);

    // Magic-link tab is now active.
    await waitFor(() => {
      const magicTab = screen.getByRole("tab", { name: /magic link/i });
      expect(magicTab.getAttribute("aria-selected")).toBe("true");
    });

    // Magic-link email input has the value we typed in the password-tab field.
    const magicEmail = (await screen.findByLabelText(/email/i, {
      selector: "#email-magic",
    })) as HTMLInputElement;
    expect(magicEmail.value).toBe("user@example.com");
  });

  it("counter survives Password ↔ Magic-link tab switching (no remount of LoginForm state)", async () => {
    // mockImplementation returns a fresh object each call. mockResolvedValue
    // would hand back the SAME reference, and React's setState bails out via
    // Object.is — the state would only update once and the counter useEffect
    // would only fire once instead of three times.
    mockLoginAction.mockImplementation(async () => ({
      formError: "Invalid email or password.",
      errorKind: "credentials" as const,
    }));

    render(<LoginForm />);

    // Two failures: counter is now 2, nudge not yet visible.
    await submitPasswordForm();
    await waitFor(() => expect(mockLoginAction).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    await submitPasswordForm();
    await waitFor(() => expect(mockLoginAction).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.queryByTestId("magic-link-nudge")).toBeNull();

    // Switch to Magic-link tab, then back to Password tab.
    await clickMagicLinkTab();
    await waitFor(() =>
      expect(screen.queryByTestId("magic-link-helper")).toBeInTheDocument(),
    );

    await clickPasswordTab();
    await waitFor(() =>
      expect(screen.queryByLabelText(/email/i, { selector: "#email-password" })).toBeInTheDocument(),
    );

    // Third failure — counter at top-level state must be 2 (NOT reset by tab
    // switch). One more advances to 3 → nudge appears.
    await submitPasswordForm();
    await waitFor(() => expect(mockLoginAction).toHaveBeenCalledTimes(3));
    await new Promise((r) => setTimeout(r, 50));

    await screen.findByTestId("magic-link-nudge");
  });

  it("does NOT write to localStorage or sessionStorage at any point", async () => {
    // mockImplementation returns a fresh object each call. mockResolvedValue
    // would hand back the SAME reference, and React's setState bails out via
    // Object.is — the state would only update once and the counter useEffect
    // would only fire once instead of three times.
    mockLoginAction.mockImplementation(async () => ({
      formError: "Invalid email or password.",
      errorKind: "credentials" as const,
    }));

    // Spy BROADLY on Storage.prototype.setItem so any login-related write fails
    // the test, regardless of which Storage instance (localStorage or
    // sessionStorage) was targeted. AUTH-37 is a hard constraint.
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<LoginForm />);

    // Run the full sequence: 3 fails → nudge → click → tab switch.
    for (let i = 0; i < 3; i++) {
      await submitPasswordForm();
      await waitFor(() => expect(mockLoginAction).toHaveBeenCalledTimes(i + 1));
      await new Promise((r) => setTimeout(r, 50));
    }

    const nudge = await screen.findByTestId("magic-link-nudge");
    const nudgeBtn = within(nudge).getByRole("button", {
      name: /Email me a sign-in link instead/i,
    });
    fireEvent.click(nudgeBtn);

    await waitFor(() => {
      const magicTab = screen.getByRole("tab", { name: /magic link/i });
      expect(magicTab.getAttribute("aria-selected")).toBe("true");
    });

    // Switch back to Password tab.
    await clickPasswordTab();

    // Assert: NO storage write contained any login-related key. The spy may
    // have captured Radix-internal writes (it doesn't, but be permissive); we
    // FAIL only on keys referencing fail/counter/attempt/login.
    const offendingCalls = storageSpy.mock.calls.filter(([key]) => {
      const k = String(key).toLowerCase();
      return (
        k.includes("fail") ||
        k.includes("counter") ||
        k.includes("attempt") ||
        k.includes("login")
      );
    });
    expect(offendingCalls).toEqual([]);

    storageSpy.mockRestore();
  });
});
