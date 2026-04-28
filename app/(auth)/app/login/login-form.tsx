"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loginSchema, type LoginInput } from "./schema";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

interface LoginFormProps {
  /** Set to true when redirected from /auth/reset-password after a successful password update. */
  resetSuccess?: boolean;
}

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
        </form>
      </CardContent>
    </Card>
  );
}
