import { Card, CardContent } from "@/components/ui/card";

/**
 * Live URL preview shown below the slug field.
 *
 * Format: yoursite.com/nsi/[slug]
 *
 * The "yoursite.com" segment is a Phase-3 placeholder. Phase 7 swaps it for the
 * per-account branded domain. Do NOT bind this to the live Vercel deploy URL —
 * Phase 7 needs to swap it atomically (CONTEXT.md "Phase-7 forward-compatibility").
 *
 * The "nsi" segment is the seeded account slug; for v1 single-tenant it's
 * hardcoded. Multi-tenant signup (v2) will read it from the current account.
 */
export function UrlPreview({ slug }: { slug: string }) {
  return (
    <Card className="bg-muted/40 border-dashed">
      <CardContent className="py-2 px-3">
        <div className="text-xs text-muted-foreground mb-1">Booking URL</div>
        <code className="text-sm font-mono break-all">
          yoursite.com/nsi/{slug || <span className="text-muted-foreground">your-slug</span>}
        </code>
      </CardContent>
    </Card>
  );
}
