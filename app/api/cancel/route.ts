import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hashToken } from "@/lib/bookings/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelBooking } from "@/lib/bookings/cancel";
import { checkRateLimit, DEFAULT_TOKEN_RATE_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

const cancelBodySchema = z.object({
  token: z.string().min(8),
  reason: z.string().max(500).optional(),
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

  // 1. Rate limit (RESEARCH §Pattern 5)
  const rl = await checkRateLimit(`cancel:${ip}`, DEFAULT_TOKEN_RATE_LIMIT.maxRequests, DEFAULT_TOKEN_RATE_LIMIT.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a few minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  // 2. Parse body
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON.", code: "BAD_REQUEST" }, { status: 400, headers: NO_STORE });
  }
  const parsed = cancelBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", code: "VALIDATION", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400, headers: NO_STORE },
    );
  }
  const { token, reason } = parsed.data;

  // 3. Resolve token to bookingId via hash + status check
  const tokenHash = await hashToken(token);
  const supabase = createAdminClient();
  const { data: booking, error: lookupError } = await supabase
    .from("bookings")
    .select("id, status, start_at")
    .eq("cancel_token_hash", tokenHash)
    .maybeSingle();

  if (lookupError) {
    console.error("[/api/cancel] lookup error:", lookupError);
    return NextResponse.json({ error: "Cancel failed.", code: "INTERNAL" }, { status: 500, headers: NO_STORE });
  }
  if (!booking || booking.status !== "confirmed" || new Date(booking.start_at) <= new Date()) {
    return NextResponse.json(
      { error: "This link is no longer active.", code: "NOT_ACTIVE" },
      { status: 410, headers: NO_STORE },
    );
  }

  // 4. Delegate to shared cancel function (Plan 06-03)
  const result = await cancelBooking({
    bookingId: booking.id,
    actor: "booker",
    reason,
    appUrl: appUrl(req),
    ip,
  });

  if (!result.ok) {
    if (result.reason === "not_active") {
      return NextResponse.json(
        { error: "This link is no longer active.", code: "NOT_ACTIVE" },
        { status: 410, headers: NO_STORE },
      );
    }
    return NextResponse.json({ error: "Cancel failed.", code: "INTERNAL" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
