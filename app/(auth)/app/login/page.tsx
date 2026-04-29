import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthHero } from "@/app/(auth)/_components/auth-hero";
import { LoginForm } from "./login-form";

interface Props {
  searchParams: Promise<{ reset?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/app");

  const { reset } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form column */}
      <main className="flex flex-col items-center justify-center bg-white px-6 py-12 md:py-20 lg:px-12">
        <div className="w-full max-w-sm">
          <header className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
              Sign in to your dashboard
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Enter your email and password to continue.
            </p>
          </header>
          <LoginForm resetSuccess={reset === "success"} />
        </div>
      </main>
      {/* Right: NSI hero (lg+ only) */}
      <AuthHero headline="Welcome back to your bookings" />
    </div>
  );
}
