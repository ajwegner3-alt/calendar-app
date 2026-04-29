/**
 * Plan 12-04b Task 1 — DayDetailRow unit tests.
 *
 * Uses @testing-library/react + jsdom (default env).
 *
 * vi.hoisted() pattern documented in 12-04a-SUMMARY.md: vitest hoists
 * vi.mock() factories to the top of the file; variables declared after
 * mock calls trigger TDZ errors. Use vi.hoisted() to declare mock spies.
 *
 * Coverage:
 *   (a) Renders booker name, formatted start time, event-type name
 *   (b) Cancel button opens AlertDialog with destructive copy
 *   (c) Cancel confirm calls cancelBookingAsOwner with booking.id and toasts success
 *   (d) Copy-reschedule-link confirm calls regenerateRescheduleTokenAction;
 *       success path calls navigator.clipboard.writeText with composed URL
 *   (e) Clipboard failure: falls back to inline readOnly input
 *   (f) Send-reminder confirm calls sendReminderForBookingAction and toasts success
 *   (g) Error toast appears when action returns { error }
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { MonthBooking } from "@/app/(shell)/app/_lib/load-month-bookings";

// ---------------------------------------------------------------------------
// Mocks — declared with vi.hoisted to avoid TDZ with factory hoisting
// ---------------------------------------------------------------------------

const {
  mockCancelBookingAsOwner,
  mockRegenerateRescheduleTokenAction,
  mockSendReminderForBookingAction,
  mockToast,
  mockToastSuccess,
  mockToastError,
  mockRouterRefresh,
} = vi.hoisted(() => ({
  mockCancelBookingAsOwner: vi.fn(),
  mockRegenerateRescheduleTokenAction: vi.fn(),
  mockSendReminderForBookingAction: vi.fn(),
  mockToast: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockRouterRefresh: vi.fn(),
}));

vi.mock("@/app/(shell)/app/bookings/[id]/_lib/actions", () => ({
  cancelBookingAsOwner: mockCancelBookingAsOwner,
  sendReminderForBookingAction: mockSendReminderForBookingAction,
}));

vi.mock("@/app/(shell)/app/_lib/regenerate-reschedule-token", () => ({
  regenerateRescheduleTokenAction: mockRegenerateRescheduleTokenAction,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(mockToast, {
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

const BOOKING: MonthBooking = {
  id: "booking-id-1",
  start_at: "2026-05-06T14:00:00Z",
  booker_name: "Alice Smith",
  booker_email: "alice@example.com",
  status: "confirmed",
  reschedule_token_hash: "some-hash",
  event_type: { name: "Consultation" },
};

const TZ = "America/Chicago";

// ---------------------------------------------------------------------------
// Import component AFTER mocks are registered
// ---------------------------------------------------------------------------

import { DayDetailRow } from "@/app/(shell)/app/_components/day-detail-row";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DayDetailRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("(a) renders booker name, start time, and event-type name", () => {
    render(<DayDetailRow booking={BOOKING} accountTimezone={TZ} />);

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Consultation", { exact: false })).toBeInTheDocument();
    // Time is formatted — just check the AM/PM marker is present in some element
    // (exact time rendering depends on Intl locale in jsdom)
    const timeEl = screen.getByText(/AM|PM/i);
    expect(timeEl).toBeInTheDocument();
  });

  it("(b) Cancel button opens AlertDialog with destructive copy", async () => {
    render(<DayDetailRow booking={BOOKING} accountTimezone={TZ} />);

    // The Cancel trigger button has data-slot="alert-dialog-trigger"
    // Use getAllByRole and pick the first one (the Cancel booking trigger, not the dialog "Cancel" button)
    const cancelBtns = screen.getAllByRole("button", { name: /^cancel$/i });
    fireEvent.click(cancelBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
    expect(screen.getByText(/cancel this booking/i)).toBeInTheDocument();
    // Alice Smith appears in both the metadata row and the dialog description — use getAllByText
    const aliceEls = screen.getAllByText(/alice smith/i);
    expect(aliceEls.length).toBeGreaterThanOrEqual(1);
  });

  it("(c) Cancel confirm calls cancelBookingAsOwner with booking.id and toasts success", async () => {
    mockCancelBookingAsOwner.mockResolvedValue({ ok: true });

    render(<DayDetailRow booking={BOOKING} accountTimezone={TZ} />);

    // Open the cancel dialog — use getAllByRole, take the trigger (first Cancel button)
    const cancelBtns = screen.getAllByRole("button", { name: /^cancel$/i });
    fireEvent.click(cancelBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    // Click "Yes, cancel" confirm button
    const confirmBtn = screen.getByRole("button", { name: /yes, cancel/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockCancelBookingAsOwner).toHaveBeenCalledWith("booking-id-1");
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Booking cancelled.");
    });
    await waitFor(() => {
      expect(mockRouterRefresh).toHaveBeenCalled();
    });
  });

  it("(d) Copy-reschedule-link confirm calls regenerateRescheduleTokenAction and clipboard.writeText", async () => {
    const RAW_TOKEN = "raw-token-abc123";
    mockRegenerateRescheduleTokenAction.mockResolvedValue({
      ok: true,
      rawToken: RAW_TOKEN,
    });

    // Mock clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
    });

    render(<DayDetailRow booking={BOOKING} accountTimezone={TZ} />);

    const copyBtn = screen.getByRole("button", { name: /copy reschedule link/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /generate & copy/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockRegenerateRescheduleTokenAction).toHaveBeenCalledWith("booking-id-1");
    });
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining(`/reschedule/${RAW_TOKEN}`),
      );
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Reschedule link copied.");
    });
  });

  it("(e) clipboard failure: shows inline readOnly fallback input", async () => {
    const RAW_TOKEN = "raw-token-fallback";
    mockRegenerateRescheduleTokenAction.mockResolvedValue({
      ok: true,
      rawToken: RAW_TOKEN,
    });

    // Clipboard throws (e.g. permission denied)
    const writeTextMock = vi.fn().mockRejectedValue(new Error("Permission denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
    });

    render(<DayDetailRow booking={BOOKING} accountTimezone={TZ} />);

    const copyBtn = screen.getByRole("button", { name: /copy reschedule link/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /generate & copy/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockRegenerateRescheduleTokenAction).toHaveBeenCalledWith("booking-id-1");
    });

    // Fallback input should appear with the reschedule URL
    await waitFor(() => {
      const fallbackInput = screen.getByRole("textbox", {
        name: /reschedule link/i,
      });
      expect(fallbackInput).toBeInTheDocument();
      expect((fallbackInput as HTMLInputElement).value).toContain(
        `/reschedule/${RAW_TOKEN}`,
      );
      expect((fallbackInput as HTMLInputElement).readOnly).toBe(true);
    });
  });

  it("(f) Send-reminder confirm calls sendReminderForBookingAction and toasts success", async () => {
    mockSendReminderForBookingAction.mockResolvedValue({ ok: true });

    render(<DayDetailRow booking={BOOKING} accountTimezone={TZ} />);

    const reminderBtn = screen.getByRole("button", { name: /send reminder/i });
    fireEvent.click(reminderBtn);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    // Confirm
    const confirmBtn = screen.getByRole("button", { name: /^send reminder$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSendReminderForBookingAction).toHaveBeenCalledWith("booking-id-1");
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Reminder sent.");
    });
  });

  it("(g) error toast appears when cancelBookingAsOwner returns { error }", async () => {
    mockCancelBookingAsOwner.mockResolvedValue({ error: "Booking not found." });

    render(<DayDetailRow booking={BOOKING} accountTimezone={TZ} />);

    const cancelBtns = screen.getAllByRole("button", { name: /^cancel$/i });
    fireEvent.click(cancelBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /yes, cancel/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Booking not found.");
    });
    // Router refresh should NOT have been called on error
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });

  it("(g) error toast appears when regenerateRescheduleTokenAction returns { error }", async () => {
    mockRegenerateRescheduleTokenAction.mockResolvedValue({
      ok: false,
      error: "not found",
    });

    render(<DayDetailRow booking={BOOKING} accountTimezone={TZ} />);

    const copyBtn = screen.getByRole("button", { name: /copy reschedule link/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /generate & copy/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("not found");
    });
  });

  it("(g) error toast appears when sendReminderForBookingAction returns { error }", async () => {
    mockSendReminderForBookingAction.mockResolvedValue({
      error: "Reminder is only available for confirmed bookings.",
    });

    render(<DayDetailRow booking={BOOKING} accountTimezone={TZ} />);

    const reminderBtn = screen.getByRole("button", { name: /send reminder/i });
    fireEvent.click(reminderBtn);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /^send reminder$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Reminder is only available for confirmed bookings.",
      );
    });
  });
});
