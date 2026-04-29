"use client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";

interface FloatingHeaderPillProps {
  accountName: string;
  logoUrl: string | null;
}

/**
 * Cruip "Simple Light" floating glass header pill.
 * Fixed-position, rounded-2xl, white/90 with backdrop-blur, gradient hairline border.
 * Renders on all viewports: hamburger trigger always visible (mobile uses sidebar full-screen drawer).
 *
 * Phase 12 Plan 03 — UI-03 requirement.
 */
export function FloatingHeaderPill({ accountName, logoUrl }: FloatingHeaderPillProps) {
  return (
    <header className="fixed top-2 z-30 w-full md:top-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className="relative flex h-14 items-center justify-between gap-3 rounded-2xl bg-white/90 px-3 shadow-lg shadow-black/[0.03] backdrop-blur-sm before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(var(--color-gray-100),var(--color-gray-200))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)]"
        >
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:flex" />
            <Link href="/app" className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={accountName} className="h-7 w-auto" />
              ) : (
                <span className="text-sm font-semibold text-gray-900">{accountName}</span>
              )}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {/* Future: account avatar dropdown (deferred to v1.2) */}
          </div>
        </div>
      </div>
    </header>
  );
}
