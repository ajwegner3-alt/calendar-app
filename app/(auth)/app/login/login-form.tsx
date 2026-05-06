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
import { loginSchema, type LoginInput } from "./schema";
import { loginAction, initiateGoogleOAuthAction, type LoginState } from "./actions";

const initialState: LoginState = {};

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

interface LoginFormProps {
  /** Set to true when redirected from /auth/reset-password after a successful password update. */
  resetSuccess?: boolean;
}

/**
 * Login form (AUTH-05).
 *
 * Phase 34: Google OAuth button appears FIRST (CONTEXT.md lock — mirrors signup),
 * above email/password card with "or" divider.
 * useSearchParams is isolated in GoogleErrorAlerts wrapped in Suspense (Next.js requirement).
 */
export function LoginForm({ resetSuccess }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  const {
    register,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
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

      {/* Google OAuth button — appears FIRST per CONTEXT.md lock (mirrors signup) */}
      <form action={initiateGoogleOAuthAction}>
        <GoogleOAuthButton type="submit" label="Sign in with Google" />
      </form>

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-3 text-gray-500">or</span>
        </div>
      </div>

      {/* Email/password card — unchanged below divider */}
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            {resetSuccess && (
              <Alert role="status">
                <AlertDescription>
                  Password updated. Please sign in with your new password.
                </AlertDescription>
              </Alert>
            )}
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
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/app/signup"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
