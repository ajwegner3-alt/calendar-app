import Link from "next/link";
import { Header } from "@/app/_components/header";
import { BackgroundGlow } from "@/app/_components/background-glow";
import { Button } from "@/components/ui/button";

/**
 * /account-deleted
 *
 * Rendered after softDeleteAccountAction sets accounts.deleted_at = now(),
 * signs the user out, and redirects here. No session required.
 *
 * Note (Plan 10-07): if the user logs back in, they will land on /app/unlinked
 * because their accounts row is filtered by deleted_at IS NULL in /app/page.tsx.
 * This UX hole is acceptable for v1.1 per the plan — document in Phase 13 QA.
 *
 * Phase 16-03 re-skin (AUTH-13/14/16): full NSI shell treatment — bg-gray-50 +
 * BackgroundGlow + <Header variant="auth" /> + centered white card. Bare
 * underlined <a> replaced with styled <Button asChild><Link>.
 */
export default function AccountDeletedPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50">
      <BackgroundGlow />
      <Header variant="auth" />
      <main className="relative z-10 mx-auto w-full max-w-md px-4 pt-20 md:pt-24 pb-12">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Account deleted</h1>
          <p className="mt-4 text-gray-600">
            Your account and booking link have been removed. If this was a
            mistake, please contact support.
          </p>
          <Button asChild className="mt-6">
            <Link href="/app/login">Back to log in</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
