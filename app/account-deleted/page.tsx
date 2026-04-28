/**
 * /account-deleted
 *
 * Rendered after softDeleteAccountAction sets accounts.deleted_at = now(),
 * signs the user out, and redirects here. No session required.
 *
 * Note (Plan 10-07): if the user logs back in, they will land on /app/unlinked
 * because their accounts row is filtered by deleted_at IS NULL in /app/page.tsx.
 * This UX hole is acceptable for v1.1 per the plan — document in Phase 13 QA.
 */
export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen flex items-start justify-center p-8 pt-24">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-semibold">Account deleted</h1>
        <p className="mt-4 text-gray-600">
          Your account and booking link have been removed. If this was a
          mistake, please contact support.
        </p>
        <a
          href="/app/login"
          className="mt-6 inline-block text-blue-600 underline hover:text-blue-800"
        >
          Back to log in
        </a>
      </div>
    </div>
  );
}
