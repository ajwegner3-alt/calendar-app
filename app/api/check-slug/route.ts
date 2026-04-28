import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { suggestSlugAlternatives } from "@/lib/slug-suggestions";
import { z } from "zod";

const querySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
});

/**
 * GET /api/check-slug?slug=foo
 *
 * Returns:
 *   { available: true }
 *   { available: false, reason: "invalid" }        — slug fails regex
 *   { available: false, reason: "unauthorized" }   — not authenticated (401)
 *   { available: false, reason: "reserved" }       — slug in RESERVED_SLUGS
 *   { available: false, reason: "taken", suggestions: string[] } — taken by another tenant
 *
 * Fails OPEN on DB error (returns available: true) — the accounts.slug unique
 * constraint in completeOnboardingAction will catch any last-second collision.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ slug: url.searchParams.get("slug") });

  if (!parsed.success) {
    // Slug failed regex validation (empty, too short, invalid chars, etc.)
    return NextResponse.json({ available: false, reason: "invalid" }, { status: 200 });
  }

  const { slug } = parsed.data;

  // Auth check — only authenticated users in onboarding need this.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return NextResponse.json({ available: false, reason: "unauthorized" }, { status: 401 });
  }

  // Reserved short-circuit — free (no DB call).
  // Distinct messaging: "This URL is reserved" ≠ "taken by another tenant".
  if (isReservedSlug(slug)) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  // Collision check via SECURITY DEFINER RPC.
  // A plain `accounts` SELECT via RLS would only see the user's own row
  // (WHERE owner_user_id = auth.uid()), giving false "available" for other
  // tenants' slugs. The slug_is_taken() function reads all non-deleted rows.
  const { data: isTaken, error } = await supabase.rpc("slug_is_taken", { p_slug: slug });

  if (error) {
    // Fail OPEN on DB error — the accounts unique constraint is the safety net.
    console.error("[check-slug] slug_is_taken RPC error (failing open):", error);
    return NextResponse.json({ available: true });
  }

  if (isTaken) {
    const email = claims.claims.email ?? "";
    const suggestions = suggestSlugAlternatives(slug, email);
    return NextResponse.json({ available: false, reason: "taken", suggestions });
  }

  return NextResponse.json({ available: true });
}
