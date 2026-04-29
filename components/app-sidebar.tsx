"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  CalendarDays,
  Clock,
  Palette,
  Settings,
  Home,
  ChevronDown,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import type { ChromeTintIntensity } from "@/lib/branding/types";
import { chromeTintToCss, chromeTintTextColor } from "@/lib/branding/chrome-tint";

/**
 * Sidebar IA — Phase 12 Plan 03 flat list (UI-05):
 * Home / Event Types / Availability / Bookings / Branding / Settings (accordion)
 *
 * Settings expands in-place (inline accordion) to Reminders + Profile.
 * Defaults open when pathname.startsWith('/app/settings').
 * Mobile: full-screen drawer via --sidebar-width-mobile: 100vw (globals.css).
 *
 * Phase 12.5: receives backgroundColor + chromeTintIntensity to tint sidebar chrome.
 */

const TOP_ITEMS = [
  { label: "Home",         href: "/app",               Icon: Home },
  { label: "Event Types",  href: "/app/event-types",   Icon: CalendarRange },
  { label: "Availability", href: "/app/availability",  Icon: Clock },
  { label: "Bookings",     href: "/app/bookings",      Icon: CalendarDays },
  { label: "Branding",     href: "/app/branding",      Icon: Palette },
] as const;

interface AppSidebarProps {
  email: string;
  backgroundColor: string | null;
  chromeTintIntensity: ChromeTintIntensity;
}

export function AppSidebar({ email, backgroundColor, chromeTintIntensity }: AppSidebarProps) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/app/settings"),
  );

  // Phase 12.5: derive sidebar tint values from brand color + intensity.
  // chromeTintToCss returns null when intensity='none' or no color — ?? undefined
  // removes the inline style and lets the sidebar's CSS token (--sidebar) apply.
  const sidebarBgTint = chromeTintToCss(backgroundColor, chromeTintIntensity, "sidebar");
  // chromeTintTextColor returns '#000000' or '#ffffff' when tinting is active, else null.
  // Applied as --sidebar-foreground CSS variable override so all nav text/icons inherit.
  const sidebarTextColor = chromeTintTextColor(backgroundColor, chromeTintIntensity, "sidebar");

  return (
    <Sidebar
      collapsible="icon"
      style={{
        backgroundColor: sidebarBgTint ?? undefined,
        ...(sidebarTextColor
          ? ({ "--sidebar-foreground": sidebarTextColor } as React.CSSProperties)
          : {}),
      }}
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Flat nav items */}
              {TOP_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={
                      item.href === "/app"
                        ? pathname === "/app"
                        : pathname === item.href ||
                          pathname.startsWith(item.href + "/")
                    }
                  >
                    <Link href={item.href}>
                      <item.Icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Settings inline accordion */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setSettingsOpen((v) => !v)}
                  isActive={pathname.startsWith("/app/settings")}
                  aria-expanded={settingsOpen}
                  tooltip="Settings"
                >
                  <Settings />
                  <span>Settings</span>
                  <ChevronDown
                    className={`ml-auto transition-transform duration-200 ${
                      settingsOpen ? "rotate-180" : ""
                    }`}
                  />
                </SidebarMenuButton>
                {settingsOpen && (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/app/settings/reminders"}
                      >
                        <Link href="/app/settings/reminders">Reminders</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/app/settings/profile"}
                      >
                        <Link href="/app/settings/profile">Profile</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
          {email}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action="/auth/signout" method="POST" className="w-full">
              <SidebarMenuButton type="submit" tooltip="Log out" className="w-full">
                <LogOut />
                <span>Log out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
