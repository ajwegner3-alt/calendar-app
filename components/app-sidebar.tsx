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
  CreditCard,
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

/**
 * Sidebar IA — Phase 12 Plan 03 flat list (UI-05):
 * Home / Event Types / Availability / Bookings / Branding / Settings (accordion)
 *
 * Settings expands in-place (inline accordion) to Reminders + Profile.
 * Defaults open when pathname.startsWith('/app/settings').
 * Mobile: full-screen drawer via --sidebar-width-mobile: 100vw (globals.css).
 *
 * Phase 15: glass treatment (bg-white/80 backdrop-blur-sm) — no per-account
 * color props. Sidebar background is uniform translucent white (OWNER-02).
 */

const TOP_ITEMS = [
  { label: "Home",         href: "/app",               Icon: Home },
  { label: "Event Types",  href: "/app/event-types",   Icon: CalendarRange },
  { label: "Availability", href: "/app/availability",  Icon: Clock },
  { label: "Bookings",     href: "/app/bookings",      Icon: CalendarDays },
  { label: "Branding",     href: "/app/branding",      Icon: Palette },
  { label: "Billing",      href: "/app/billing",       Icon: CreditCard },
] as const;

interface AppSidebarProps {
  email: string;
}

export function AppSidebar({ email }: AppSidebarProps) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/app/settings"),
  );

  return (
    <Sidebar
      collapsible="icon"
      className="bg-white/80 backdrop-blur-sm"
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
                        isActive={pathname === "/app/settings/gmail"}
                      >
                        <Link href="/app/settings/gmail">Gmail</Link>
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
