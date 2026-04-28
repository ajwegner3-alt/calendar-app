/**
 * Generate 3 slug alternatives when the requested slug is taken.
 *
 * Strategy:
 *   1. base + "-2"                    (e.g., "acme-2")
 *   2. base + "-" + email-prefix      (e.g., "acme-andrew", or "acme-3" if prefix == base)
 *   3. base + "-bookings"             (e.g., "acme-bookings")
 *
 * All outputs validated against /^[a-z0-9-]{3,40}$/.
 * Caller is responsible for re-checking these against accounts.slug + RESERVED_SLUGS
 * (the picker UI treats them as suggestions; the completeOnboardingAction will catch
 * any last-second collision at the DB unique-constraint level).
 */
export function suggestSlugAlternatives(base: string, email: string): string[] {
  const toSlug = (s: string): string =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

  const emailPrefix = toSlug(email.split("@")[0] ?? "");

  // Candidate 2: use email prefix unless it equals base (would produce a duplicate).
  const candidate2 =
    emailPrefix && emailPrefix !== base
      ? toSlug(`${base}-${emailPrefix}`)
      : toSlug(`${base}-3`);

  return [
    toSlug(`${base}-2`),
    candidate2,
    toSlug(`${base}-bookings`),
  ].filter((s) => /^[a-z0-9-]{3,40}$/.test(s));
}
