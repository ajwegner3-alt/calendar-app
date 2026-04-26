import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hashToken } from "@/lib/bookings/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { rescheduleBooking } from "@/lib/bookings/reschedule";
import { checkRateLimit, DEFAULT_TOKEN_RATE_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

const rescheduleBodySchema = z.object({
  token: z.string().min(8),
  startAt: z.string().min(20), // ISO 8601
  endAt: z.string().min(20),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function appUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : req.nextUrl.origin)
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // 1. Rate limit
  const rl = await checkRateLimit(`reschedule:${ip}`, DEFAULT_TOKEN_RATE_LIMIT.maxRequests, DEFAULT_TOKEN_RATE_LIMIT.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a few minutes.", code: "RATE_LIMITED" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  // 2. Parse body
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON.", code: "BAD_REQUEST" }, { status: 400, headers: NO_STORE });
  }
  const parsed = rescheduleBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", code: "VALIDATION", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400, headers: NO_STORE },
    );
  }
  const { token, startAt, endAt } = parsed.data;

  // 3. Resolve token to bookingId (and capture the OLD reschedule_token_hash for the CAS guard)
  const tokenHash = await hashToken(token);
  const supabase = createAdminClient();
  const { data: booking, error: lookupError } = await supabase
    .from("bookings")
    .select("id, status, start_at")
    .eq("reschedule_token_hash", tokenHash)
    .maybeSingle();

  if (lookupError) {
    console.error("[/api/reschedule] lookup error:", lookupError);
    return NextResponse.json({ error: "Reschedule failed.", code: "INTERNAL" }, { status: 500, headers: NO_STORE });
  }
  if (!booking || booking.status !== "confirmed" || new Date(booking.start_at) <= new Date()) {
    return NextResponse.json(
      { error: "This link is no longer active.", code: "NOT_ACTIVE" },
      { status: 410, headers: NO_STORE },
    );
  }

  // 4. Delegate to shared reschedule function (Plan 06-03)
  const result = await rescheduleBooking({
    bookingId: booking.id,
    oldRescheduleHash: tokenHash,    // CAS guard against concurrent-token use (RESEARCH Pitfall 6)
    newStartAt: startAt,
    newEndAt: endAt,
    appUrl: appUrl(req),
    ip,
  });

  if (!result.ok) {
    if (result.reason === "slot_taken") {
      return NextResponse.json(
        { error: "That time was just booked. Pick a new time.", code: "SLOT_TAKEN" },
        { status: 409, headers: NO_STORE },
      );
    }
    if (result.reason === "not_active") {
      return NextResponse.json(
        { error: "This link is no longer active.", code: "NOT_ACTIVE" },
        { status: 410, headers: NO_STORE },
      );
    }
    if (result.reason === "bad_slot") {
      return NextResponse.json(
        { error: result.error ?? "Invalid slot.", code: "BAD_SLOT" },
        { status: 400, headers: NO_STORE },
      );
    }
    return NextResponse.json({ error: "Reschedule failed.", code: "INTERNAL" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
