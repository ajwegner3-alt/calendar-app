import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Returns true when the viewport is below the MOBILE_BREAKPOINT (768px).
 *
 * Refactored from the shadcn-generated useState + useEffect(matchMedia) pattern
 * to useSyncExternalStore (Plan 09-01 lint cleanup). useSyncExternalStore is
 * the canonical React 19+ pattern for matchMedia subscriptions — it cleanly
 * eliminates the set-state-in-effect lint violation, makes the SSR snapshot
 * explicit, and avoids any tearing during concurrent rendering.
 *
 * Server snapshot returns false (desktop-first SSR; the actual mobile
 * narrowing kicks in on the first client paint via the subscribe callback).
 */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribeToMobileMediaQuery,
    getIsMobileSnapshot,
    getIsMobileServerSnapshot,
  )
}

function subscribeToMobileMediaQuery(onChange: () => void): () => void {
  // Only the browser has matchMedia; SSR will never call subscribe.
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getIsMobileSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getIsMobileServerSnapshot(): boolean {
  // Default to desktop on the server. The hook hydrates and re-renders with
  // the correct value on the first client paint.
  return false
}
