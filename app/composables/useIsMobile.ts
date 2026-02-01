/**
 * Composable for detecting mobile devices using media query.
 * Uses the same breakpoint as Tailwind's `md:` (768px).
 *
 * Returns `false` during SSR to avoid hydration mismatches.
 */
export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}
