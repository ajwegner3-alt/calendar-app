---
phase: 07-widget-and-branding
plan: 09
type: execute
wave: 4
depends_on: ["07-03", "07-05"]
files_modified:
  - app/(shell)/app/event-types/_components/row-actions-menu.tsx
  - app/(shell)/app/event-types/_components/embed-code-dialog.tsx
  - app/(shell)/app/event-types/_components/embed-tabs.tsx
  - app/(shell)/app/event-types/_lib/embed-snippets.ts
  - components/ui/tabs.tsx
autonomous: false

must_haves:
  truths:
    - "Each event-type row's kebab menu has a 'Get embed code' item"
    - "Clicking 'Get embed code' opens a Dialog with two tabs: 'Script (recommended)' and 'iframe fallback'"
    - "Script tab shows: <script src='${appUrl}/widget.js'> + <div data-nsi-calendar='${accountSlug}/${eventSlug}'></div>"
    - "iframe tab shows: <iframe src='${appUrl}/embed/${accountSlug}/${eventSlug}' width='100%' height='600' frameborder='0'></iframe>"
    - "Each tab has a Copy button that (a) copies snippet to clipboard, (b) shows 'Copied!' on the button for 2 seconds, (c) fires a Sonner toast"
    - "A live preview iframe of /embed/${accountSlug}/${eventSlug} renders alongside the snippets"
    - "Archived event types do NOT show 'Get embed code' option (only active rows have it)"
  artifacts:
    - path: "components/ui/tabs.tsx"
      provides: "shadcn Tabs primitive (newly installed via shadcn CLI)"
      exports: ["Tabs", "TabsList", "TabsTrigger", "TabsContent"]
    - path: "app/(shell)/app/event-types/_lib/embed-snippets.ts"
      provides: "Pure functions: buildScriptSnippet(opts) + buildIframeSnippet(opts)"
      exports: ["buildScriptSnippet", "buildIframeSnippet"]
    - path: "app/(shell)/app/event-types/_components/embed-code-dialog.tsx"
      provides: "Dialog client component: tabs + copy buttons + preview iframe + open/close state"
      exports: ["EmbedCodeDialog"]
    - path: "app/(shell)/app/event-types/_components/embed-tabs.tsx"
      provides: "Inner Tabs wrapper with Script + iframe content + per-tab Copy button"
      exports: ["EmbedTabs"]
    - path: "app/(shell)/app/event-types/_components/row-actions-menu.tsx"
      provides: "Updated kebab menu with 'Get embed code' item that opens EmbedCodeDialog"
  key_links:
    - from: "app/(shell)/app/event-types/_components/embed-code-dialog.tsx"
      to: "/widget.js"
      via: "buildScriptSnippet generates <script src='${appUrl}/widget.js'>"
      pattern: "/widget.js"
    - from: "app/(shell)/app/event-types/_components/embed-code-dialog.tsx"
      to: "/embed/[account]/[event-slug]"
      via: "iframe snippet + live preview iframe both target this URL"
      pattern: "/embed/"
    - from: "Copy button"
      to: "navigator.clipboard.writeText"
      via: "client-side clipboard API"
      pattern: "clipboard"
---

<objective>
Add a "Get embed code" entry to the event-types kebab menu (active rows only). Clicking opens a Dialog with two tabs (Script recommended / iframe fallback) showing copy-paste snippets. Each tab has a Copy button with belt-and-suspenders feedback (button label "Copied!" for 2s + Sonner toast). A live preview iframe of `/embed/<account>/<event-slug>` renders alongside the snippets so the owner sees what visitors see.

Purpose: Delivers EMBED-05 (script snippet per event type) + EMBED-06 (iframe fallback snippet). CONTEXT lock: snippets live in the kebab dialog (NOT a separate sidebar Embed page); tabs labeled exactly "Script (recommended)" + "iframe fallback".

Output: shadcn `tabs.tsx` primitive installed; new `embed-snippets.ts` builders; new `EmbedCodeDialog` + `EmbedTabs` client components; updated `row-actions-menu.tsx` to mount the dialog.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07-widget-and-branding/07-CONTEXT.md
@.planning/phases/07-widget-and-branding/07-RESEARCH.md
@.planning/phases/07-widget-and-branding/07-03-SUMMARY.md
@.planning/phases/07-widget-and-branding/07-05-SUMMARY.md

# Files modified
@app/(shell)/app/event-types/_components/row-actions-menu.tsx
@app/(shell)/app/event-types/_components/event-types-table.tsx
@app/(shell)/app/event-types/_lib/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install shadcn Tabs primitive + build snippet functions</name>
  <files>
    components/ui/tabs.tsx
    app/(shell)/app/event-types/_lib/embed-snippets.ts
  </files>
  <action>
    Step 1 — Install shadcn Tabs:
    ```bash
    npx shadcn@latest add tabs
    ```
    This creates `components/ui/tabs.tsx`. Phase 3 STATE lock: shadcn CLI v4.x uses the `radix-ui` monorepo package (already installed). No new package install expected; just the wrapper file.

    Verify after install: `cat components/ui/tabs.tsx` shows imports from `radix-ui` (NOT individual `@radix-ui/react-tabs`). If it tries to install a separate `@radix-ui/react-tabs` package, ALLOW it — newer shadcn CLI may revert; either pattern is acceptable as long as build is green.

    Step 2 — Create `app/(shell)/app/event-types/_lib/embed-snippets.ts`:
    ```typescript
    export interface SnippetOpts {
      appUrl: string;       // e.g., "https://calendar-app-xi-smoky.vercel.app"
      accountSlug: string;  // e.g., "nsi"
      eventSlug: string;    // e.g., "consultation"
    }

    /**
     * Recommended snippet — script tag + mount-point div.
     * Multiline string mirrors what owner pastes into Squarespace/WordPress HTML block.
     */
    export function buildScriptSnippet({ appUrl, accountSlug, eventSlug }: SnippetOpts): string {
      const base = appUrl.replace(/\/$/, "");
      return `<div data-nsi-calendar="${accountSlug}/${eventSlug}"></div>
    <script src="${base}/widget.js" defer></script>`;
    }

    /**
     * Fallback snippet — raw iframe, no JS.
     * Use when the host site blocks <script> tags (rare).
     * Height 600 is a sensible default; owner can adjust.
     */
    export function buildIframeSnippet({ appUrl, accountSlug, eventSlug }: SnippetOpts): string {
      const base = appUrl.replace(/\/$/, "");
      return `<iframe
      src="${base}/embed/${accountSlug}/${eventSlug}"
      width="100%"
      height="600"
      frameborder="0"
      style="border:0;display:block;"
      title="Booking widget"
    ></iframe>`;
    }
    ```

    KEY DECISIONS:
    - Script snippet uses `defer` so the script loads asynchronously (better host-page performance).
    - Mount-point div BEFORE the script tag — script's `init()` runs at DOMContentLoaded; element must be in DOM by then.
    - iframe snippet defaults `height="600"` (CONTEXT: no owner-configured min-height, but the iframe needs SOME starting height; 600 is reasonable).
    - `replace(/\/$/, "")` strips trailing slash from appUrl defensively.
  </action>
  <verify>
    `npm run build` succeeds.
    `components/ui/tabs.tsx` exists.
    `npm test` — no regressions.
    Smoke: `node -e "console.log(require('./app/(shell)/app/event-types/_lib/embed-snippets.ts'))"` won't work for TS; instead `npx tsc --noEmit` passes.
  </verify>
  <done>
    Tabs primitive installed; snippet builders exist; both produce copy-pasteable HTML strings.
  </done>
</task>

<task type="auto">
  <name>Task 2: Build EmbedCodeDialog + EmbedTabs client components</name>
  <files>
    app/(shell)/app/event-types/_components/embed-code-dialog.tsx
    app/(shell)/app/event-types/_components/embed-tabs.tsx
  </files>
  <action>
    Create `embed-tabs.tsx` (`"use client"`):
    ```tsx
    "use client";

    import { useState } from "react";
    import { toast } from "sonner";
    import { Button } from "@/components/ui/button";
    import {
      Tabs,
      TabsContent,
      TabsList,
      TabsTrigger,
    } from "@/components/ui/tabs";
    import {
      buildScriptSnippet,
      buildIframeSnippet,
    } from "../_lib/embed-snippets";

    interface EmbedTabsProps {
      appUrl: string;
      accountSlug: string;
      eventSlug: string;
    }

    export function EmbedTabs({ appUrl, accountSlug, eventSlug }: EmbedTabsProps) {
      const opts = { appUrl, accountSlug, eventSlug };
      const scriptSnippet = buildScriptSnippet(opts);
      const iframeSnippet = buildIframeSnippet(opts);

      return (
        <Tabs defaultValue="script" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="script">Script (recommended)</TabsTrigger>
            <TabsTrigger value="iframe">iframe fallback</TabsTrigger>
          </TabsList>
          <TabsContent value="script" className="mt-4">
            <SnippetBlock snippet={scriptSnippet} kind="script" />
          </TabsContent>
          <TabsContent value="iframe" className="mt-4">
            <SnippetBlock snippet={iframeSnippet} kind="iframe" />
          </TabsContent>
        </Tabs>
      );
    }

    function SnippetBlock({ snippet, kind }: { snippet: string; kind: "script" | "iframe" }) {
      const [copied, setCopied] = useState(false);

      const handleCopy = async () => {
        try {
          await navigator.clipboard.writeText(snippet);
          setCopied(true);
          toast.success(kind === "script" ? "Script snippet copied" : "iframe snippet copied");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Copy failed — select the text manually");
        }
      };

      return (
        <div className="space-y-2">
          <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-48">{snippet}</pre>
          <Button
            type="button"
            variant={copied ? "secondary" : "default"}
            onClick={handleCopy}
            className="w-full sm:w-auto"
          >
            {copied ? "Copied!" : "Copy snippet"}
          </Button>
        </div>
      );
    }
    ```

    Create `embed-code-dialog.tsx` (`"use client"`):
    ```tsx
    "use client";

    import {
      Dialog,
      DialogContent,
      DialogDescription,
      DialogHeader,
      DialogTitle,
    } from "@/components/ui/dialog";
    import { EmbedTabs } from "./embed-tabs";

    interface EmbedCodeDialogProps {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      appUrl: string;
      accountSlug: string;
      eventSlug: string;
      eventName: string;
    }

    export function EmbedCodeDialog({
      open,
      onOpenChange,
      appUrl,
      accountSlug,
      eventSlug,
      eventName,
    }: EmbedCodeDialogProps) {
      const previewSrc = `${appUrl.replace(/\/$/, "")}/embed/${accountSlug}/${eventSlug}`;

      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Embed: {eventName}</DialogTitle>
              <DialogDescription>
                Paste one of these snippets into your website. The script version is recommended for auto-resizing; iframe is the fallback.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <EmbedTabs appUrl={appUrl} accountSlug={accountSlug} eventSlug={eventSlug} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Live preview:</p>
                <iframe
                  src={previewSrc}
                  title="Embed preview"
                  width="100%"
                  height="500"
                  style={{ border: "1px solid #e5e7eb", borderRadius: 6, display: "block" }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    }
    ```

    KEY DECISIONS:
    - Dialog uses `max-w-3xl` for the two-column layout (snippets + preview).
    - Preview iframe is bounded at height 500 (preview only — actual embed auto-resizes via postMessage in production).
    - `appUrl` is passed as a prop (computed by parent — see Task 3) so the snippets show the correct production URL even in dev/preview deploys.
    - `onOpenChange` controlled by parent (RowActionsMenu owns dialog open state).
  </action>
  <verify>
    `npx tsc --noEmit` passes.
    Both components exist.
  </verify>
  <done>
    EmbedTabs renders 2 tabs with copy buttons + Sonner toasts; EmbedCodeDialog wraps tabs + live preview iframe in a Dialog.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire 'Get embed code' into RowActionsMenu (active rows only) + pass appUrl + accountSlug</name>
  <files>
    app/(shell)/app/event-types/_components/row-actions-menu.tsx
    app/(shell)/app/event-types/_components/event-types-table.tsx
    app/(shell)/app/event-types/_lib/types.ts
  </files>
  <action>
    Step 1 — Update `EventTypeListItem` type to include `slug` (it's selected in page.tsx but may not be in the type yet — verify and add if missing):

    Edit `app/(shell)/app/event-types/_lib/types.ts`. The existing `EventTypeListItem` is `Pick<EventTypeRow, "id" | "name" | "slug" | "duration_minutes" | "is_active" | "deleted_at" | "created_at">` — slug is already there. Confirm via grep, no changes needed.

    Step 2 — Update `event-types-table.tsx` to pass `accountSlug` + `appUrl` down to RowActionsMenu:

    Read the file first. The current RowActionsMenu invocation likely takes `id`, `name`, `isActive`, `isArchived`. Add 4 new props: `slug` (event-type slug), `accountSlug` (resolved server-side from current owner's account), `appUrl` (env-derived).

    Resolve `accountSlug` + `appUrl` in `app/(shell)/app/event-types/page.tsx` (the parent Server Component) and pass them through:
    - `appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://calendar-app-xi-smoky.vercel.app"`
    - `accountSlug` = SELECT slug FROM accounts WHERE id IN (current_owner_account_ids()) LIMIT 1; pass as a single string prop

    Pass through EventTypesTable -> RowActionsMenu.

    Step 3 — Edit `row-actions-menu.tsx`:

    Add to props:
    ```typescript
    slug: string;
    accountSlug: string;
    appUrl: string;
    ```

    Add new state:
    ```typescript
    const [embedOpen, setEmbedOpen] = useState(false);
    ```

    Inside the `{!isArchived && (...)}` branch, add a new DropdownMenuItem after "Make active/inactive" (before the destructive separator):
    ```tsx
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        setEmbedOpen(true);
      }}
    >
      Get embed code
    </DropdownMenuItem>
    ```

    Below the existing `<DeleteConfirmDialog>` and `<RestoreCollisionDialog>`, mount the embed dialog:
    ```tsx
    <EmbedCodeDialog
      open={embedOpen}
      onOpenChange={setEmbedOpen}
      appUrl={appUrl}
      accountSlug={accountSlug}
      eventSlug={slug}
      eventName={name}
    />
    ```

    Import EmbedCodeDialog at the top.

    DO NOT add the embed item to the archived branch — only active rows have functioning event-slug pages, so embedding archived events would point to a 404.
  </action>
  <verify>
    `npm run build` succeeds.
    `npm test` — no regressions.
    Manual: visit /app/event-types, click kebab on an active row → see "Get embed code" entry between "Make active/inactive" and "Archive".
    Click "Get embed code" → Dialog opens with Script tab selected; snippet visible; preview iframe loads; Copy button works (toast fires + button text changes for 2s).
    Switch to iframe tab → iframe snippet visible; Copy works.
    Click kebab on an archived row → "Get embed code" NOT present.
  </verify>
  <done>
    Kebab menu has "Get embed code" on active rows; dialog renders snippets + preview; copy + toast feedback work.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Andrew tests the embed end-to-end (snippet → paste into HTML → live render)</name>
  <what-built>
    Get-embed-code dialog on every active event-type row, with copy-paste Script snippet + iframe fallback + live preview, AND a fully working widget.js that injects the iframe on third-party HTML pages.
  </what-built>
  <how-to-verify>
    1. /app/event-types → kebab on an active event → "Get embed code" → dialog opens.
    2. Both tabs show valid snippets. Copy each — confirm toast + button label change.
    3. Live preview iframe shows the actual booking flow.
    4. Open a text editor. Create a file `/tmp/embed-test.html`:
       ```html
       <!DOCTYPE html>
       <html>
         <head><title>Test embed</title></head>
         <body>
           <h1>Testing embed</h1>
           <p>Booking widget below:</p>
           <!-- PASTE THE SCRIPT SNIPPET HERE -->
           <p>Footer content after</p>
         </body>
       </html>
       ```
       Paste the SCRIPT snippet you copied in step 2 where the comment is.
    5. Open the HTML file in a browser via file://path/to/embed-test.html.
    6. Verify:
       - Initial skeleton appears briefly
       - Booking widget loads inside the page (no extra scrollbars; widget height matches content)
       - You can pick a date and time, fill the form, and submit a booking (use a throwaway email)
       - Confirmation arrives in inbox
    7. Replace the SCRIPT snippet with the IFRAME snippet (re-copy from the iframe tab). Refresh.
    8. Verify iframe renders too (less smooth — fixed height 600 — but functional).
    9. Add a SECOND `<div data-nsi-calendar="...">` after the script tag (same event slug or a different active one). Refresh.
    10. Verify both mounts render independently with their own iframe.
    11. Add a DUPLICATE `<script src="...widget.js">` tag. Refresh.
    12. Verify NO duplicate iframes (idempotency guard works).
    13. (Optional) Test on a real Squarespace page → DEFERRED to Phase 9 (EMBED-07). Skip for this checkpoint.
  </how-to-verify>
  <resume-signal>
    Reply "embed snippet approved" to wrap Plan 07-09. If anything fails (script doesn't inject iframe, copy fails, preview broken, double-iframes when duplicate script), describe and we'll fix.
  </resume-signal>
</task>

</tasks>

<verification>
- shadcn Tabs primitive installed cleanly.
- Snippet functions return correct HTML strings (script with defer, iframe with width 100%).
- Dialog renders with two tabs + preview iframe.
- Copy button + toast + label-swap feedback all work.
- Active rows only get the embed entry.
- End-to-end smoke on file:// HTML: widget loads + auto-resizes + booking completes.
</verification>

<success_criteria>
1. EMBED-05: Script snippet shown per active event type (Script + iframe tabs in dialog).
2. EMBED-06: Raw iframe fallback snippet shown.
3. CONTEXT lock: location is event-types kebab (NOT separate page); tabs labeled exactly "Script (recommended)" + "iframe fallback"; copy feedback is belt-and-suspenders (button label + toast).
4. Live preview iframe shows actual /embed/* render.
5. End-to-end: paste snippet → load HTML → widget injects + auto-resizes + booking completes.
</success_criteria>

<output>
After completion, create `.planning/phases/07-widget-and-branding/07-09-SUMMARY.md` documenting:
- shadcn Tabs install outcome (radix-ui monorepo or separate package)
- Snippet HTML formats locked (script with defer, iframe height=600)
- Dialog two-column layout + bounded preview iframe
- Copy feedback pattern (clipboard API + toast + 2s label swap)
- Active-only constraint (archived rows don't show embed entry)
- Smoke test outcome (which hosts tested, multi-widget + idempotency confirmed)
- Forward note: EMBED-07 (live Squarespace/WordPress test) is the Phase 9 checkpoint
</output>
