"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleOAuthButton } from "@/components/google-oauth-button";
import { signupSchema, type SignupInput } from "./schema";
import { signUpAction, initiateGoogleOAuthAction, type SignupState } from "./actions";

const initialState: SignupState = {};

/**
 * Inner component that reads useSearchParams — must be inside a Suspense boundary.
 * Renders Google error alerts for ?google_error=init_failed and ?google_error=access_denied.
 */
function GoogleErrorAlerts() {
  const params = useSearchParams();
  const googleError = params.get("google_error");

  if (googleError === "init_failed") {
    return (
      <Alert variant="destructive" className="mb-3" role="alert">
        <AlertDescription>Google sign-in couldn&apos;t start. Please try again.</AlertDescription>
      </Alert>
    );
  }
  if (googleError === "access_denied") {
    return (
      <Alert variant="destructive" className="mb-3" role="alert">
        <AlertDescription>
          You cancelled the Google sign-in. You can try again or use email and password below.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}

/**
 * Signup form (AUTH-05).
 *
 * Fields: email + password ONLY per CONTEXT.md lock.
 * Post-submit: always redirects to /app/verify-email (handled in Server Action).
 * Visual restyle deferred to Phase 12 (UI-12).
 *
 * Phase 34: Google OAuth button appears FIRST (CONTEXT.md lock), above email/password card.
 * useSearchParams is isolated in GoogleErrorAlerts wrapped in Suspense (Next.js requirement).
 *
 * Phase 45 (AUTH-34): Google OAuth visually demoted BELOW the email/password
 * Card. Email/password is the primary CTA; OAuth is the secondary alternative
 * below an OR divider. The OAuth FORM, divider markup, and GoogleErrorAlerts
 * placement remain otherwise identical to Phase 34. Pure DOM reorder.
 */
export function SignupForm() {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    initialState,
  );

  const {
    register,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
    errors: state.fieldErrors
      ? {
          email: state.fieldErrors.email?.[0]
            ? { type: "server", message: state.fieldErrors.email[0] }
            : undefined,
          password: state.fieldErrors.password?.[0]
            ? { type: "server", message: state.fieldErrors.password[0] }
            : undefined,
        }
      : undefined,
  });

  return (
    <div className="flex flex-col gap-0">
      {/* Google error alerts — useSearchParams requires Suspense boundary */}
      <Suspense fallback={null}>
        <GoogleErrorAlerts />
      </Suspense>

      {/* Email/password card — primary CTA, appears ABOVE OAuth (Phase 45 AUTH-34) */}
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            {state.formError && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{state.formError}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? "Creating account…" : "Create account"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/app/login"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Log in
              </Link>
            </p>

            <p className="text-center text-sm text-muted-foreground">
              Forgot password?{" "}
              <Link
                href="/app/forgot-password"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Reset it
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-3 text-gray-500">or</span>
        </div>
      </div>

      {/* Google OAuth button — appears BELOW Card per Phase 45 (AUTH-34) — demoted to secondary CTA */}
      <form action={initiateGoogleOAuthAction}>
        <GoogleOAuthButton type="submit" label="Sign up with Google" />
      </form>
    </div>
  );
}
