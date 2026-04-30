import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { BackgroundGlow } from "@/app/_components/background-glow";
import { Header } from "@/app/_components/header";

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
  // OWNER-11: Trimmed to id only — slug not referenced in this layout.
  // Columns removed: sidebar_color, sidebar_text_color, background_color,
  // background_shade, chrome_tint_intensity, brand_primary (Phase 15 cleanup).
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", claimsData.claims.sub)
    .is("deleted_at", null)
    .limit(1);

  if (!accounts || accounts.length === 0) {
    redirect("/app/unlinked");
  }

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar email={email} />
        <SidebarInset className="relative overflow-hidden bg-gray-50">
          <BackgroundGlow />
          <Header />
          <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6 md:pt-24 pb-12">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
