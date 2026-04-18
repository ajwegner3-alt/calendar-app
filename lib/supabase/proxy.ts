import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Phase 1 bootstrap guard: if env vars are not populated yet (fresh clone,
  // first `npm run dev` before `.env.local` is filled in), skip the Supabase
  // session refresh rather than crashing the request. Removed implicitly once
  // the env is real — the no-op branch does nothing when both vars are set.
  // Mirrors the canonical `with-supabase` template's `hasEnvVars` pattern.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // A simple mistake could make it very hard to debug users being randomly logged out.
  // IMPORTANT: use getClaims() (NOT getUser()) — this is the auth-refresh call.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Phase 1 has no auth-gated routes yet; keep the user check commented out
  // or scoped so anon public routes stay public. Phase 2 (auth) wires this up.
  // if (!user && request.nextUrl.pathname.startsWith("/app")) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/login";
  //   return NextResponse.redirect(url);
  // }
  void user;

  return supabaseResponse;
}
