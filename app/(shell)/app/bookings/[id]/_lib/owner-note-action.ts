"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Owner-note save action (Plan 08-07).
 *
 * Two-stage owner authorization (mirrors Phase 7 branding `getOwnerAccountIdOrThrow`
 * + Plan 08-05 reminder-toggles `saveReminderTogglesAction`):
 *
 *   Stage 1: RLS-scoped client confirms current owner's account ids via the
 *            `current_owner_account_ids()` RPC.
 *   Stage 2: RLS-scoped SELECT proves the target booking belongs to one of
 *            those account ids (RLS itself is the boundary — a permissive
 *            select against another tenant returns null).
 *   Stage 3: Service-role admin client performs the UPDATE. Authorization
 *            was already proved; admin bypasses RLS so we don't pay for a
 *            second policy round-trip.
 *
 * Why the RPC + ownership pre-check (instead of just an RLS-scoped UPDATE):
 *   - Matches the established owner-write pattern: Phase 6 owner-cancel,
 *     Phase 7 branding, Plan 08-05 reminder-toggles. Consistency across the
 *     owner-write surface keeps the security model auditable.
 *   - Surfaces a clear "not your booking" denial path WITHOUT leaking which
 *     UUIDs exist in other tenants — both 404-equivalent and forbidden return
 *     the identical error string ("Booking not found.").
 *   - Service-role UPDATE bypasses RLS once authorization is proved, avoiding
 *     a second round-trip through RLS policies.
 */

export type SaveOwnerNoteResult = { ok: true } | { ok: false; error: string };

interface SaveOwnerNoteArgs {
  bookingId: string;
  /** Empty string is valid (means "clear note" — normalized to NULL in DB). */
  note: string;
}

/** Generous-but-bounded cap to prevent abuse / oversized rows. */
const OWNER_NOTE_MAX_LEN = 5000;

/**
 * Inner authorization + write logic, exported for direct vitest invocation.
 *
 * The Server Action wrapper (`saveOwnerNoteAction` below) is what the client
 * calls; it imports this function so the test suite can exercise the same
 * logic without standing up a Next.js request scope (cookies() / next/cache
 * both require one). This mirrors the Phase 6 cancel-test pattern documented
 * in STATE.md line 178: tests call the inner module directly.
 *
 * Accepts already-resolved Supabase clients via DI so unit tests can inject
 * mock builders. Production callers (the Server Action below) pass real
 * clients constructed from the standard helpers.
 */
export async function saveOwnerNoteCore(
  args: SaveOwnerNoteArgs,
  deps: {
    rlsClient: { rpc: (fn: string) => Promise<{ data: unknown }>;
                 from: (table: string) => unknown };
    adminClient: { from: (table: string) => unknown };
  },
): Promise<SaveOwnerNoteResult> {
  // Cap length BEFORE any DB call so abuse never reaches the wire.
  const note =
    args.note.length > OWNER_NOTE_MAX_LEN
      ? args.note.slice(0, OWNER_NOTE_MAX_LEN)
      : args.note;

  // ── Stage 1: who am I? ────────────────────────────────────────────────
  const { data: ids } = await deps.rlsClient.rpc("current_owner_account_ids");
  const ownerAccountIds: string[] = Array.isArray(ids) ? (ids as string[]) : [];
  if (ownerAccountIds.length === 0) {
    // Not signed in OR not linked to any account. Identical error to
    // "booking not found" so anonymous probes can't distinguish them.
    return { ok: false, error: "Booking not found." };
  }

  // ── Stage 2: does the booking belong to me? ───────────────────────────
  // Use the RLS-scoped client so RLS itself enforces the boundary; no
  // chance of a permissive query leaking another tenant's booking id.
  // (The RPC result is also checked below as defense-in-depth.)
  const builder = deps.rlsClient.from("bookings") as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{
          data: { id: string; account_id: string } | null;
        }>;
      };
    };
  };
  const { data: booking } = await builder
    .select("id, account_id")
    .eq("id", args.bookingId)
    .maybeSingle();

  if (!booking || !ownerAccountIds.includes(booking.account_id)) {
    // Identical error string for not-found and forbidden — no UUID-existence
    // leakage across tenants (matches Phase 6 cancel convention).
    return { ok: false, error: "Booking not found." };
  }

  // ── Stage 3: service-role UPDATE — RLS already proved authorization ───
  const updateBuilder = deps.adminClient.from("bookings") as {
    update: (patch: { owner_note: string | null }) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await updateBuilder
    .update({ owner_note: note.length > 0 ? note : null })
    .eq("id", args.bookingId);

  if (error) {
    return { ok: false, error: "Save failed." };
  }

  return { ok: true };
}

/**
 * Server Action — the entry point called from the client component.
 *
 * Constructs real Supabase clients and delegates to `saveOwnerNoteCore`.
 * Calls `revalidatePath` so a subsequent navigation/refresh shows the
 * persisted note. (The autosave UX itself is fully optimistic; revalidate
 * is for the "refresh and confirm" mental model.)
 */
export async function saveOwnerNoteAction(
  args: SaveOwnerNoteArgs,
): Promise<SaveOwnerNoteResult> {
  const rls = await createClient();
  const admin = createAdminClient();

  const result = await saveOwnerNoteCore(args, {
    // Cast bridges the SupabaseClient runtime to the structural interface
    // we declared above. The shape contract is what tests rely on.
    rlsClient: rls as unknown as Parameters<typeof saveOwnerNoteCore>[1]["rlsClient"],
    adminClient: admin as unknown as Parameters<typeof saveOwnerNoteCore>[1]["adminClient"],
  });

  if (result.ok) {
    revalidatePath(`/app/bookings/${args.bookingId}`);
  }
  return result;
}
