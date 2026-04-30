'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { WORDMARK } from '@/lib/brand';

function getContextLabel(pathname: string): string {
  if (pathname === '/app') return 'Dashboard';
  if (pathname.startsWith('/app/event-types')) return 'Event Types';
  if (pathname.startsWith('/app/availability')) return 'Availability';
  if (pathname.startsWith('/app/bookings')) return 'Bookings';
  if (pathname.startsWith('/app/branding')) return 'Branding';
  if (pathname.startsWith('/app/settings')) return 'Settings';
  return '';
}

export function Header() {
  const pathname = usePathname();
  const label = getContextLabel(pathname);

  return (
    <header className="fixed top-2 md:top-6 left-0 right-0 z-30 px-4">
      <div className="max-w-[1152px] mx-auto h-14 px-4 rounded-2xl flex items-center justify-between bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
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
