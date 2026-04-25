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

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar email={email} />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
            <SidebarTrigger />
            <span className="text-sm font-medium text-primary">NSI</span>
          </header>
          <div className="p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
