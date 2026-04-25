/**
 * Converts a string to a URL-friendly slug.
 *
 * Pure, isomorphic (no DOM APIs, no Node-only APIs) — safe to call from
 * both Server Components and Client Components.
 *
 * Rules:
 *   - NFKD-normalize, then strip diacritics
 *   - lowercase
 *   - replace any non [a-z0-9 -] with empty
 *   - collapse whitespace runs to single hyphen
 *   - collapse repeated hyphens
 *   - trim leading/trailing hyphens
 *
 * Matches the regex used in eventTypeSchema.slug: /^[a-z0-9-]+$/
 */
export function slugify(str: string): string {
  return String(str)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
