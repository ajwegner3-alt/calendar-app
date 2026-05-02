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
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          // AUTH-20 v1.3: forward cache-control headers from @supabase/ssr@0.10.2's
          // SetAllCookies callback. Without this, cache directives emitted during
          // token refresh aren't propagated to the response, which can cause CDN
          // cache poisoning on rotation. The `headers` argument is part of the
          // current SetAllCookies type signature.
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
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

  // Phase 2: gate /app/* on authentication. Public auth routes are reachable
  // without a session so unauthenticated users can sign up, recover passwords,
  // and confirm email tokens.
  // AUTH-18 (v1.3): /app/signup was broken because only /app/login was exempted.
  const publicAuthPaths = [
    "/app/login",
    "/app/signup",
    "/app/forgot-password",
    "/app/verify-email",
  ];
  const { pathname } = request.nextUrl;
  if (
    !user &&
    pathname.startsWith("/app") &&
    !publicAuthPaths.includes(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
