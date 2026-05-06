"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Reads ?google_linked=1 (set by /auth/google-callback for existing-user link case)
 * and fires the locked CONTEXT.md banner copy ONCE, then strips the param so a refresh
 * doesn't re-fire it.
 */
export function GoogleLinkToast() {
  const params = useSearchParams();
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (params.get("google_linked") !== "1") return;
    fired.current = true;
    toast.success(
      "Your account is now connected to Google — you can sign in either way.",
      { duration: 6000 },
    );
    // Strip the param so refresh doesn't re-fire.
    router.replace("/app", { scroll: false });
  }, [params, router]);

  return null;
}
