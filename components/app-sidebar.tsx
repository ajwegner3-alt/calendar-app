"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Palette,
  Inbox,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { href: "/app/event-types", label: "Event Types", icon: CalendarDays },
  { href: "/app/availability", label: "Availability", icon: Clock },
  { href: "/app/branding", label: "Branding", icon: Palette },
  { href: "/app/bookings", label: "Bookings", icon: Inbox },
] as const;

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/app" className="flex items-center gap-2 px-2 py-2">
          <span className="text-lg font-semibold text-primary">NSI</span>
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Bookings
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
