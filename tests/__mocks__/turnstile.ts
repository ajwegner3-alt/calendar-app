/**
 * Vitest mock for @/lib/turnstile.
 *
 * Wired via vitest.config.ts resolve.alias so the route handler under test
 * imports this instead of the real Cloudflare-hitting module. Tests call
 * __setTurnstileResult(false) to exercise the 403 path.
 *
 * Default: returns true (passes Turnstile) so happy-path tests don't need setup.
 * Reset to true in beforeEach via __setTurnstileResult(true).
 *
 * Phase 4 STATE.md lock: path.resolve(__dirname, ...) used in vitest.config.ts
 * alias (NOT new URL().pathname — encodes spaces as %20 on Windows).
 */

let __result = true;

export function __setTurnstileResult(v: boolean): void {
  __result = v;
}

export async function verifyTurnstile(
  _token: string,
  _ip?: string,
): Promise<boolean> {
  return __result;
}
