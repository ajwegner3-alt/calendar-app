'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { WORDMARK } from '@/lib/brand';
import type { Branding } from '@/lib/branding/types';

function getContextLabel(pathname: string): string {
  if (pathname === '/app') return 'Dashboard';
  if (pathname.startsWith('/app/event-types')) return 'Event Types';
  if (pathname.startsWith('/app/availability')) return 'Availability';
  if (pathname.startsWith('/app/bookings')) return 'Bookings';
  if (pathname.startsWith('/app/branding')) return 'Branding';
  if (pathname.startsWith('/app/settings')) return 'Settings';
  return '';
}

interface HeaderProps {
  variant?: 'owner' | 'auth' | 'public';
  rightLabel?: string;
  /** Required when variant="public". Provides logo + account name for the pill. */
  branding?: Branding;
  /** Required when variant="public". Provides account name text for the right slot. */
  accountName?: string;
}

/**
 * Glass header pill. Default variant="owner" renders with sidebar offset and SidebarTrigger.
 * variant="auth" renders without the sidebar offset and without SidebarTrigger — use on
 * auth and onboarding pages that have no sidebar.
 * variant="public" renders a branded pill with account logo + name — use on public booking
 * surfaces (no sidebar, no NSI wordmark, branding prop required). Phase 17 (HDR-05, HDR-06).
 *
 * rightLabel overrides the pathname-derived right-slot label. Used by onboarding to
 * display a static "Setup" label across all 3 steps.
 */
export function Header({ variant = 'owner', rightLabel, branding, accountName }: HeaderProps) {
  const pathname = usePathname();
  const label = rightLabel ?? getContextLabel(pathname);

  if (variant === 'public') {
    // Phase 17 (HDR-05, HDR-06): Public pill — logo (or initial fallback) on left,
    // account name on right. Glass treatment matches owner pill (white/90 + blur)
    // for visual family continuity across surfaces.
    // MP-04: all hex values are inline styles — no Tailwind class composition with runtime hex.
    const logoUrl = branding?.logoUrl ?? null;
    const primaryColor = branding?.primaryColor ?? '#3B82F6';
    const name = accountName ?? '';
    const initial = name.charAt(0).toUpperCase() || 'N';

    return (
      <header className="fixed top-2 md:top-6 left-0 right-0 z-30 px-4">
        <div className="max-w-[1152px] mx-auto h-14 px-4 rounded-2xl flex items-center justify-between bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`${name} logo`}
                style={{ maxHeight: 40, maxWidth: 140, height: 'auto', width: 'auto' }}
              />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
                aria-hidden="true"
              >
                {initial}
              </div>
            )}
          </div>
          {name && (
            <span className="text-[13px] font-medium text-gray-700">
              {name}
            </span>
          )}
        </div>
      </header>
    );
  }

  const outerClassName =
    variant === 'auth'
      ? 'fixed top-2 md:top-6 left-0 right-0 z-30 px-4'
      : 'fixed top-2 md:top-6 left-0 md:left-[var(--sidebar-width)] right-0 z-30 px-4';

  return (
    <header className={outerClassName}>
      <div className="max-w-[1152px] mx-auto h-14 px-4 rounded-2xl flex items-center justify-between bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2">
          {variant !== 'auth' && <SidebarTrigger className="md:hidden" />}
          <Link href="/app" className="text-lg font-extrabold tracking-[-0.04em]">
            <span className="text-gray-900">{WORDMARK.prefix}</span>
            <span className="text-blue-500">{WORDMARK.suffix}</span>
          </Link>
        </div>
        {label && (
          <span className="text-[13px] font-medium text-gray-500">
            {label}
          </span>
        )}
      </div>
    </header>
  );
}
