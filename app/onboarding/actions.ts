"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { step1Schema, step2Schema, step3Schema } from "./schema";
import { sendWelcomeEmail } from "@/lib/onboarding/welcome-email";

export type ActionResult = { error: string } | { success: true };

// ---------------------------------------------------------------------------
// Step 1 — account name + slug
// ---------------------------------------------------------------------------

export async function saveStep1Action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = step1Schema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { error: msg };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/app/login");

  const { error } = await supabase
    .from("accounts")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      onboarding_step: 2,
    })
    .eq("owner_user_id", claims.claims.sub)
    .is("deleted_at", null);

  if (error) {
    // Check for unique slug constraint violation.
    if (error.code === "23505") {
      return { error: "That URL is already taken. Please choose another." };
    }
    return { error: `Failed to save: ${error.message}` };
  }

  redirect("/onboarding/step-2-timezone");
}

// ---------------------------------------------------------------------------
// Step 2 — timezone
// ---------------------------------------------------------------------------

export async function saveStep2Action(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = step2Schema.safeParse({
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { error: "Invalid timezone value." };
  }

  // Server-side IANA validation.
  try {
    Intl.DateTimeFormat(undefined, { timeZone: parsed.data.timezone });
  } catch {
    return { error: "Unrecognised timezone. Please select from the list." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/app/login");

  const { error } = await supabase
    .from("accounts")
    .update({
      timezone: parsed.data.timezone,
      onboarding_step: 3,
    })
    .eq("owner_user_id", claims.claims.sub)
    .is("deleted_at", null);

  if (error) {
    return { error: `Failed to save: ${error.message}` };
  }

  redirect("/onboarding/step-3-event-type");
}

// ---------------------------------------------------------------------------
// Step 3 — complete onboarding (event type + availability + mark complete)
// ---------------------------------------------------------------------------

export async function completeOnboardingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const durationRaw = formData.get("duration_minutes");
  const parsed = step3Schema.safeParse({
    name: formData.get("name"),
    duration_minutes: durationRaw ? parseInt(String(durationRaw), 10) : NaN,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { error: msg };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/app/login");

  // Fetch the accounts row (need id, timezone, name, slug, owner_email).
  const { data: accounts, error: fetchErr } = await supabase
    .from("accounts")
    .select("id, name, slug, timezone, owner_email")
    .eq("owner_user_id", claims.claims.sub)
    .is("deleted_at", null)
    .limit(1);

  if (fetchErr || !accounts?.[0]) {
    return { error: "Could not find your account. Please reload and try again." };
  }

  const me = accounts[0];

  // Validate that steps 1+2 data has been saved (slug + name + timezone must be set).
  if (!me.slug || !me.name || !me.timezone) {
    return {
      error:
        "Please complete steps 1 and 2 before finishing. Your account information is incomplete.",
    };
  }

  // -------------------------------------------------------------------------
  // Build event-type slug from the user-supplied name (kebab-cased).
  // Note: event_types unique constraint is (account_id, slug) — different
  // accounts CAN both have slug="consultation". No collision risk between tenants.
  // -------------------------------------------------------------------------
  const eventSlug = parsed.data.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "consultation";

  // -------------------------------------------------------------------------
  // STEP A: Insert 5 default availability_rules (Mon–Fri 09:00–17:00).
  // 09:00 = minute 540, 17:00 = minute 1020.
  // day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.
  // The timezone column on the account row stores the user's IANA TZ; the
  // availability_rules table stores wall-clock minutes (they're timezone-aware
  // at the slot-calculation layer which reads the account's timezone).
  // -------------------------------------------------------------------------
  const availabilityRows = [1, 2, 3, 4, 5].map((dow) => ({
    account_id: me.id,
    day_of_week: dow,
    start_minute: 540,  // 09:00
    end_minute: 1020,   // 17:00
  }));

  const { data: insertedRules, error: availErr } = await supabase
    .from("availability_rules")
    .insert(availabilityRows)
    .select("id");

  if (availErr) {
    return { error: `Failed to create availability schedule: ${availErr.message}` };
  }

  // -------------------------------------------------------------------------
  // STEP B: Insert 1 event_types row.
  // max_bookings_per_slot is OMITTED — Phase 11 adds this column with DEFAULT 1.
  // Hardcoding it here would crash because the column does not exist yet.
  // -------------------------------------------------------------------------
  const { error: etError } = await supabase.from("event_types").insert({
    account_id: me.id,
    name: parsed.data.name,
    slug: eventSlug,
    duration_minutes: parsed.data.duration_minutes,
    is_active: true,
    // Omitted columns take defaults from initial_schema:
    //   buffer_before_minutes: 0, buffer_after_minutes: 0,
    //   min_notice_minutes: 60, max_advance_days: 60,
    //   custom_questions: '[]', description: null
  });

  if (etError) {
    // Rollback: delete the availability_rules we just inserted.
    if (insertedRules && insertedRules.length > 0) {
      const ruleIds = insertedRules.map((r: { id: string }) => r.id);
      await supabase
        .from("availability_rules")
        .delete()
        .in("id", ruleIds);
    }
    return { error: `Failed to create event type: ${etError.message}` };
  }

  // -------------------------------------------------------------------------
  // STEP C: Mark account as onboarding complete.
  // Only reached if both INSERTs succeeded.
  // -------------------------------------------------------------------------
  const { error: completeErr } = await supabase
    .from("accounts")
    .update({ onboarding_complete: true })
    .eq("owner_user_id", claims.claims.sub)
    .is("deleted_at", null);

  if (completeErr) {
    // Very unlikely (RLS issue or network). Don't rollback inserts —
    // they're safe orphaned rows; the next wizard attempt will re-run step 3.
    return { error: `Failed to finalize account: ${completeErr.message}` };
  }

  // -------------------------------------------------------------------------
  // STEP D: Welcome email — fire-and-forget (non-fatal if it fails).
  // -------------------------------------------------------------------------
  sendWelcomeEmail({
    id: me.id,
    owner_email: me.owner_email ?? claims.claims.email ?? "",
    name: me.name,
    slug: me.slug,
  }).catch((err: unknown) => {
    console.error("[completeOnboardingAction] welcome email error (non-fatal):", err);
  });

  revalidatePath("/", "layout");
  redirect("/app");
}
