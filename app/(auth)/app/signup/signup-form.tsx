"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signupSchema, type SignupInput } from "./schema";
import { signUpAction, type SignupState } from "./actions";

const initialState: SignupState = {};

/**
 * Signup form (AUTH-05).
 *
 * Fields: email + password ONLY per CONTEXT.md lock.
 * Post-submit: always redirects to /app/verify-email (handled in Server Action).
 * Visual restyle deferred to Phase 12 (UI-12).
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
  );
}
