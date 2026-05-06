"use client";
import Link from "next/link";
import { GoogleOAuthButton } from "@/components/google-oauth-button";
import { connectGmailAction } from "@/app/(shell)/app/settings/gmail/_lib/actions";

export function ConnectGmailCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-medium text-gray-900">Connect Gmail (optional)</h2>
      <p className="mt-2 text-sm text-gray-600">
        Connect your Gmail so the app can send booking confirmations from your address in a future update.
      </p>
      <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
        Skipping is fine for now — you can connect Gmail later from Settings.
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <form action={connectGmailAction}>
          <GoogleOAuthButton type="submit" label="Connect Gmail" />
        </form>
        <Link
          href="/onboarding"
          className="text-center text-sm text-gray-500 underline-offset-4 hover:underline"
        >
          Skip for now
        </Link>
      </div>
    </div>
  );
}
