"use client";

import { useState, useTransition } from "react";
import { requestUpgradeAction } from "../_lib/actions";

type UpgradeFormProps = {
  lockedOut: boolean;
  timeRemaining: string | null; // "18h 23m" — null when not locked out
};

const MESSAGE_MAX_LENGTH = 2000;

export function UpgradeForm({ lockedOut, timeRemaining }: UpgradeFormProps) {
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // SUCCESS STATE — replaces the form area entirely until next page reload.
  if (submitted) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-medium">Request received</p>
        <p className="mt-1">
          Andrew will be in touch within 1 business day. Reload this page later
          to confirm the request was recorded.
        </p>
      </div>
    );
  }

  const disabled = lockedOut || isPending;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return;
    setErrorMsg(null);
    startTransition(async () => {
      const result = await requestUpgradeAction({ message });
      if (result.ok) {
        setSubmitted(true);
      } else {
        setErrorMsg(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="upgrade-message" className="block text-sm font-medium">
          Message (optional)
        </label>
        <textarea
          id="upgrade-message"
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={5}
          disabled={disabled}
          placeholder="Anything Andrew should know?"
          className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Submit request"}
        </button>

        {lockedOut && timeRemaining && (
          <p className="text-sm text-muted-foreground">
            Already requested. Try again in {timeRemaining}.
          </p>
        )}
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600" role="alert">
          {errorMsg}
        </p>
      )}
    </form>
  );
}
