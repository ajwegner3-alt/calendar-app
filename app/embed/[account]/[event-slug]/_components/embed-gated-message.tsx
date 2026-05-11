// Phase 42.6: Neutral gated-message component shown in place of the embed
// booker when the account's plan_tier does not allow widget access.
//
// Server component (no client directive) — purely presentational, no state,
// no interaction. Public viewers don't have access to billing, so we deliberately
// avoid any owner-facing CTA, contact info, or NSI branding. The single
// neutral message intentionally does NOT differentiate by reason (basic_tier
// vs no_subscription) — public iframe viewers don't need that detail.
//
// Sizing: outer wrapper mirrors EmbedShell's visual envelope (bg-gray-50,
// min-h-64, relative overflow-hidden) so swapping the booker for this message
// does not cause iframe layout shift in third-party host pages.
//
// CRITICAL: route MUST return HTTP 200 with this component, NEVER notFound()
// or redirect — third-party iframes would render a broken X icon otherwise.
export function EmbedGatedMessage() {
  return (
    <div className="relative overflow-hidden bg-gray-50 flex items-center justify-center min-h-64 p-8">
      <div className="text-center">
        <p className="text-sm font-medium text-gray-900">
          This booking widget is no longer available.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Contact the business owner for details.
        </p>
      </div>
    </div>
  );
}
