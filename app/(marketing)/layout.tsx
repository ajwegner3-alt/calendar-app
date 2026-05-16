import Link from "next/link";
import { WORDMARK } from "@/lib/brand";

/**
 * Shared shell for the public marketing surface — home, privacy, terms.
 * These pages live at the domain root (booking.nsintegrations.com) and are
 * referenced by the Google OAuth consent screen (app home page + privacy
 * policy + terms of service URLs). No sidebar, no auth — fully public.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-lg font-extrabold tracking-[-0.04em]"
            aria-label="North Star Booking home"
          >
            <span className="text-gray-900">{WORDMARK.prefix}</span>
            <span className="text-blue-500">{WORDMARK.suffix}</span>
            <span className="ml-1.5 text-gray-400">Booking</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/privacy"
              className="hidden text-gray-600 transition-colors hover:text-gray-900 sm:inline"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hidden text-gray-600 transition-colors hover:text-gray-900 sm:inline"
            >
              Terms
            </Link>
            <Link
              href="/app/login"
              className="font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              Sign in
            </Link>
            <Link
              href="/app/signup"
              className="rounded-lg bg-blue-600 px-3.5 py-2 font-medium text-white transition-colors hover:bg-blue-700"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-10 text-sm text-gray-500 sm:flex-row sm:justify-between sm:px-6">
          <p>
            &copy; {new Date().getFullYear()} North Star Integrations. All
            rights reserved.
          </p>
          <nav className="flex items-center gap-5">
            <Link href="/privacy" className="transition-colors hover:text-gray-900">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-gray-900">
              Terms of Service
            </Link>
            <a
              href="https://nsintegrations.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-gray-900"
            >
              North Star Integrations
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
