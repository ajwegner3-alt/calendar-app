---
phase: 03-event-types-crud
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - components/ui/table.tsx
  - components/ui/dropdown-menu.tsx
  - components/ui/alert-dialog.tsx
  - components/ui/switch.tsx
  - components/ui/badge.tsx
  - components/ui/select.tsx
  - components/ui/textarea.tsx
  - components/ui/sonner.tsx
  - components/ui/dialog.tsx
  - app/layout.tsx
autonomous: true

must_haves:
  truths:
    - "Eight shadcn primitives required by Phase 3 are installed at components/ui/{table,dropdown-menu,alert-dialog,switch,badge,select,textarea,sonner}.tsx"
    - "shadcn Dialog primitive is also installed (used by the restore-with-slug-collision flow in Plan 04)"
    - "Sonner Toaster is mounted ONCE in the root layout (app/layout.tsx) so toast.success / toast.error fire from any client component"
    - "npm run build succeeds with the new primitives wired in (no TypeScript or Tailwind errors)"
    - "Existing Phase 2 styling and shadcn primitives still work (no regression on login page or shell layout)"
  artifacts:
    - path: "components/ui/table.tsx"
      provides: "shadcn Table primitive (TableHeader, TableBody, TableRow, TableCell, TableHead) for the event types list"
    - path: "components/ui/dropdown-menu.tsx"
      provides: "shadcn DropdownMenu primitive (kebab menu for row actions)"
    - path: "components/ui/alert-dialog.tsx"
      provides: "shadcn AlertDialog primitive (delete confirmation modal)"
    - path: "components/ui/switch.tsx"
      provides: "shadcn Switch primitive (active/inactive toggle in form, required toggle on questions)"
    - path: "components/ui/badge.tsx"
      provides: "shadcn Badge primitive (Active / Inactive / Archived status pill)"
    - path: "components/ui/select.tsx"
      provides: "shadcn Select primitive (question-type dropdown)"
    - path: "components/ui/textarea.tsx"
      provides: "shadcn Textarea primitive (description field, long-text questions)"
    - path: "components/ui/sonner.tsx"
      provides: "shadcn Sonner primitive (toast notifications)"
    - path: "components/ui/dialog.tsx"
      provides: "shadcn Dialog primitive (restore-with-slug-collision standalone Dialog)"
    - path: "app/layout.tsx"
      provides: "Root layout with <Toaster /> mounted once so toasts render anywhere in the app"
      contains: "Toaster"
  key_links:
    - from: "app/layout.tsx"
      to: "components/ui/sonner.tsx"
      via: "<Toaster /> render"
      pattern: "<Toaster"
---

<objective>
Install the eight shadcn primitives Phase 3 needs (table, dropdown-menu, alert-dialog, switch, badge, select, textarea, sonner) plus the Dialog primitive (for the restore-with-slug-collision flow), and mount the Sonner `<Toaster />` in the root layout so any client component can call `toast.success(...)` / `toast.error(...)`.

Purpose: Phase 3's list page (Table + DropdownMenu kebab + AlertDialog delete + Badge status + Dialog restore) and form (Switch + Select + Textarea) all depend on these primitives. The Toaster mount is the foundation for save/delete/restore feedback across every Phase 3 surface.

Output: All 9 component files exist under `components/ui/`, the root `app/layout.tsx` renders a single `<Toaster />`, and `npm run build` succeeds. This plan ships zero feature surface — it is pure foundation that runs in parallel to Plan 01 (schema migration).
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-event-types-crud/03-CONTEXT.md
@.planning/phases/03-event-types-crud/03-RESEARCH.md

# Existing root layout (we add <Toaster /> here)
@app/layout.tsx
@components.json
@components/ui/button.tsx
@app/globals.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install nine shadcn primitives in a single batch</name>
  <files>package.json, package-lock.json, components/ui/table.tsx, components/ui/dropdown-menu.tsx, components/ui/alert-dialog.tsx, components/ui/switch.tsx, components/ui/badge.tsx, components/ui/select.tsx, components/ui/textarea.tsx, components/ui/sonner.tsx, components/ui/dialog.tsx</files>
  <action>
Run a single shadcn add command for all required primitives. The `dialog` primitive is included alongside the eight RESEARCH-listed components because Plan 04's restore-with-slug-collision flow (RESEARCH §"Restore with Slug Collision") uses a standalone Dialog, not the AlertDialog (RESEARCH calls this out as a Radix nested-dialog avoidance pattern):

```bash
npx shadcn@latest add table dropdown-menu alert-dialog switch badge select textarea sonner dialog
```

Accept all prompts to overwrite or pull in Radix peer deps. shadcn auto-respects `style: "radix-nova"` from `components.json` (confirmed in RESEARCH §"shadcn Components to Install").

Verify each new component file exists and is non-empty:

```bash
ls components/ui/{table,dropdown-menu,alert-dialog,switch,badge,select,textarea,sonner,dialog}.tsx
```

Verify the new Radix peer dependencies were added to `package.json`. Expected additions (exact set depends on shadcn version, but should include subsets of):
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-alert-dialog`
- `@radix-ui/react-switch`
- `@radix-ui/react-select`
- `@radix-ui/react-dialog`
- `sonner`
- `next-themes` (Sonner peer dep — used by the Toaster's theme prop)

Run `npm run build` to confirm Tailwind v4 + Next 16 still compile cleanly with the new primitives in the tree (even though nothing imports them yet — the build verifies their internal type/JSX is sound).

Key rules:
- Single `npx shadcn@latest add` invocation (not 9 separate calls). Faster, single dep-resolution pass, single `package-lock.json` update.
- All adds inherit `radix-nova` style from `components.json` — do NOT pass `--style` flags.
- If shadcn prompts about overwriting an existing file (none of these should already exist), reject the overwrite and investigate — Phase 2 should not have installed any of these.
- `next-themes` may be auto-added as a Sonner peer dep — that's expected. The installed `components/ui/sonner.tsx` reads `useTheme()` from `next-themes` to forward the app's theme to Sonner. The app currently has no `<ThemeProvider>` wrapper, so Sonner will just default to `"system"` — that's fine for Phase 3 (NSI doesn't ship dark mode in v1). Do NOT add a ThemeProvider here.
- If shadcn install hangs on a peer-dep conflict (e.g., React version mismatch), STOP and report — do not work around it with `--legacy-peer-deps` without confirming the cause. The Phase 2 stack (React 19, Next 16) is shadcn-supported as of the RESEARCH date.

DO NOT:
- Do not edit any of the generated `components/ui/*.tsx` files in this task — accept shadcn's output verbatim. Customizations (if any are ever needed) belong in feature components that wrap the primitives, not in the primitives themselves.
- Do not add `sonner` directly via `npm install sonner` — let shadcn add do it (ensures the Sonner version + Toaster wrapper match).
- Do not install `cmdk`, `recharts`, or any other primitive that wasn't in the list. Phase 3 doesn't need them.
  </action>
  <verify>
```bash
# All 9 component files exist
ls components/ui/{table,dropdown-menu,alert-dialog,switch,badge,select,textarea,sonner,dialog}.tsx

# sonner package + radix peer deps were added
node -e "const p=require('./package.json');['sonner','@radix-ui/react-dropdown-menu','@radix-ui/react-alert-dialog','@radix-ui/react-switch','@radix-ui/react-select','@radix-ui/react-dialog'].forEach(n=>{const d=p.dependencies[n]||p.devDependencies[n];if(!d)throw new Error('missing '+n);console.log(n+'@'+d);});"

# Existing Phase 2 components still present (no clobber)
ls components/ui/{button,input,label,alert,card,sidebar,skeleton,sheet,separator,tooltip}.tsx

# Build passes
npm run build
```
  </verify>
  <done>
All 9 new shadcn primitives exist under `components/ui/`, the `sonner` npm package and required Radix peer deps are in `package.json` dependencies, all 10 Phase 2 primitives are still in place (no overwrite), and `npm run build` exits 0.

Commit: `chore(03-02): install Phase 3 shadcn primitives (table, dropdown-menu, alert-dialog, switch, badge, select, textarea, sonner, dialog)`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Mount Sonner Toaster in the root layout</name>
  <files>app/layout.tsx</files>
  <action>
Edit `app/layout.tsx` to import the `Toaster` from `@/components/ui/sonner` and mount it ONCE inside `<body>` (per RESEARCH §"Toast Pattern (Sonner)" and Pitfall 8: "Sonner not rendering — missing `<Toaster />` in layout").

First, READ the current `app/layout.tsx` to see its current shape (RESEARCH didn't snapshot it — Phase 1 generated it via `create-next-app` and Phase 2 did not modify it). Then add ONE import and ONE JSX element:

```tsx
import { Toaster } from "@/components/ui/sonner";

// Inside the <body> element, AFTER {children}:
<body>
  {children}
  <Toaster />
</body>
```

Place `<Toaster />` AFTER `{children}` so it portals on top of all routes' content. The Toaster portals to the document root anyway (Radix Portal), so DOM order isn't critical, but conventionally it sits as the last child of `<body>`.

Key rules:
- Mount ONCE at `app/layout.tsx` (the root layout) — NOT at `app/(shell)/layout.tsx`. The shell layout only wraps `/app/*` routes; toasts must also work on `/app/login` (not under `(shell)`) and any future public booking flow under `/[account]/[slug]` (Phase 5). Root layout is the only correct location.
- Use the shadcn-generated `Toaster` from `@/components/ui/sonner`, NOT the bare `Toaster` from the `sonner` npm package. The shadcn wrapper applies the `radix-nova` theme tokens.
- If the current `app/layout.tsx` already has any nested provider (e.g., `<ThemeProvider>` from Phase 2), insert `<Toaster />` as a sibling of the provider's `{children}` render — DO NOT wrap the Toaster inside the provider. Sonner doesn't need to be inside any provider tree.
- DO NOT add a `<TooltipProvider>` or `<SidebarProvider>` to the root layout — those belong to the shell layout (Phase 2 Plan 02-04 fix).
- DO NOT change the `<html lang>` attribute, the `<body>` className, or any Tailwind class on `<body>`.
- DO NOT remove any existing imports from `app/layout.tsx`.

After editing, run `npm run build` and `npm run lint` to confirm no regression.

DO NOT:
- Do not also add the Toaster to `app/(shell)/layout.tsx` — that would render two Toasters (overlapping notifications, doubled portal nodes).
- Do not pass props to `<Toaster />` (no `richColors`, `position`, etc.) — accept shadcn's defaults. Customization can wait for Phase 8 polish.
  </action>
  <verify>
```bash
# Toaster import + render present in root layout
grep -q 'from "@/components/ui/sonner"' app/layout.tsx && echo "import ok"
grep -q "<Toaster" app/layout.tsx && echo "render ok"

# Toaster NOT in shell layout (avoid double-mount)
! grep -q "<Toaster" "app/(shell)/layout.tsx" && echo "shell layout clean ok"

# Build + lint
npm run build
npm run lint
```
  </verify>
  <done>
`app/layout.tsx` imports `Toaster` from `@/components/ui/sonner` and renders `<Toaster />` once inside `<body>` (after `{children}`). `app/(shell)/layout.tsx` does NOT contain a Toaster (no double-mount). `npm run build` and `npm run lint` both exit 0.

Commit: `feat(03-02): mount Sonner Toaster in root layout`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# All Phase 3 primitives exist
ls components/ui/{table,dropdown-menu,alert-dialog,switch,badge,select,textarea,sonner,dialog}.tsx

# All Phase 2 primitives still present
ls components/ui/{button,input,label,alert,card,sidebar,skeleton,sheet,separator,tooltip}.tsx

# Toaster mounted in root layout
grep -q "<Toaster" app/layout.tsx

# Build + lint pass
npm run build
npm run lint

# Existing tests still green
npm test
```
</verification>

<success_criteria>
- [ ] `components/ui/{table,dropdown-menu,alert-dialog,switch,badge,select,textarea,sonner,dialog}.tsx` all exist
- [ ] `package.json` includes `sonner`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-switch`, `@radix-ui/react-select`, `@radix-ui/react-dialog`
- [ ] All Phase 2 primitives (`button`, `input`, `label`, `alert`, `card`, `sidebar`, `skeleton`, `sheet`, `separator`, `tooltip`) still exist (no clobber)
- [ ] `app/layout.tsx` imports `Toaster` from `@/components/ui/sonner` and renders it once inside `<body>`
- [ ] `app/(shell)/layout.tsx` does NOT render a Toaster (no double-mount)
- [ ] `npm run build` and `npm run lint` exit 0
- [ ] Existing Vitest suite still green
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/03-event-types-crud/03-02-SUMMARY.md` documenting:
- Final installed versions of `sonner` + each new `@radix-ui/*` peer dep (read from package.json)
- Confirmed Toaster mount location (root `app/layout.tsx`, NOT shell layout)
- Whether `next-themes` was auto-added as a Sonner peer dep (and confirmation that no ThemeProvider was added — Sonner defaults to `"system"` theme acceptably)
- Any deviation from the install list (none expected)
</output>
</content>
</invoke>