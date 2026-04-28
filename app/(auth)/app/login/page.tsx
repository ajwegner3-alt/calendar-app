import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <main className="min-h-screen grid place-items-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold text-primary">NSI</div>
          <div className="text-sm text-muted-foreground mt-1">
            North Star Integrations
          </div>
        </div>
        <LoginForm resetSuccess={reset === "success"} />
      </div>
    </main>
  );
}
