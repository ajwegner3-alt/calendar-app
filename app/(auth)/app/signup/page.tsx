import { SignupForm } from "./signup-form";

/**
 * Public signup page (AUTH-05, AUTH-07).
 *
 * Server Component shell — delegates all state and submission logic to the
 * <SignupForm /> client component. Visual restyle deferred to Phase 12 (UI-12).
 *
 * Post-submit: Server Action redirects to /app/verify-email?email={email}.
 * Email-confirm gate is ON (Supabase Dashboard) so users cannot access /app
 * until clicking the confirmation link.
 */
export default function SignupPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </main>
  );
}
