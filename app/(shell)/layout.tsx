import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { GradientBackdrop } from "@/app/_components/gradient-backdrop";
import { getBrandingForAccount } from "@/lib/branding/read-branding";
import { chromeTintToCss } from "@/lib/branding/chrome-tint";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth guard (belt + suspenders — proxy.ts also gates, but layout-level check
  // also unlocks direct access to claims for the sidebar footer).
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  // Cookie-based SSR state for shadcn Sidebar (prevents flicker).
  // Next 16 cookies() is async — await is required (RESEARCH §7.8).
  // Cookie name is "sidebar_state" (underscore) — matches the literal inside
  // the installed components/ui/sidebar.tsx (SIDEBAR_COOKIE_NAME constant).
  // Verified via Task 1 hard-assertion grep during execution (the shadcn
  // version installed in plan 02-01 ships the underscore form, not the colon
  // form referenced in older docs).
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const email = (claimsData.claims.email as string | undefined) ?? "";

  // Inline account lookup (RLS-scoped: only the owner's row returned).
  // Pattern: app/(shell)/app/page.tsx lines 19-26 (no loadAccountForUser helper exists).
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, slug, brand_primary, background_color, background_shade")
    .eq("owner_user_id", claimsData.claims.sub)
    .is("deleted_at", null)
    .limit(1);

  if (!accounts || accounts.length === 0) {
    redirect("/app/unlinked");
  }
  const account = accounts[0];

  // Branding read — getBrandingForAccount is the canonical helper (uses admin client).
  // Falls open on DB error; returns safe defaults (logoUrl=null, primaryColor=DEFAULT_BRAND_PRIMARY).
  const branding = await getBrandingForAccount(account.id);

  // Phase 12.5: per-account page background tinting.
  // chromeTintToCss returns null when intensity='none' or no background color.
  // ?? undefined removes the style attribute and lets bg-background (gray-50) apply.
  const pageBgTint = chromeTintToCss(
    branding.backgroundColor,
    branding.chromeTintIntensity,
    "page",
  );

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar
          email={email}
          backgroundColor={branding.backgroundColor}
          chromeTintIntensity={branding.chromeTintIntensity}
        />
        <SidebarInset
          className="relative overflow-hidden bg-background"
          style={{ backgroundColor: pageBgTint ?? undefined }}
        >
          <GradientBackdrop color={branding.backgroundColor} shade={branding.backgroundShade} />
          {/* Phase 12.5: plain sidebar trigger replacing FloatingHeaderPill (UI-16).
              Fixed top-left, z-20, mobile-only. No glass pill — chrome tinting
              provides the branding surface. */}
          <div className="fixed top-3 left-3 z-20 md:hidden">
            <SidebarTrigger />
          </div>
          <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 md:pt-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
