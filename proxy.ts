import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Capture the response from updateSession() — it carries Supabase auth cookie
  // mutations. Do NOT create a fresh NextResponse.next() here: that would discard
  // the cookie updates and silently log the owner out on every request (RESEARCH Pitfall 2).
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/embed/")) {
    // Embed route: third-party sites must be allowed to frame this page.
    response.headers.set("Content-Security-Policy", "frame-ancestors *");
    // Delete X-Frame-Options entirely — it conflicts with CSP frame-ancestors.
    // Some older browsers and intermediary proxies honor X-FO over CSP, which
    // would block the embed even with frame-ancestors * present (RESEARCH Pitfall 1).
    // next.config.ts sets SAMEORIGIN globally; proxy.ts removes it for /embed/*.
    response.headers.delete("X-Frame-Options");
  } else {
    // All non-embed routes: prevent framing from external origins.
    // Belt-and-suspenders alongside the next.config.ts global default.
    response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
