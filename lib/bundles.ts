/**
 * Shared copy for every confirm dialog that would break up a shift bundle.
 * Pulling one shift out invalidates the all-or-nothing offer, so the bundle
 * dissolves and the rest stay posted individually — the user has to be told
 * that the same way whether they act from the Wall or the calendar.
 *
 * Returns '' for an unbundled shift (or a bundle of one), so callers can
 * append it unconditionally.
 */
export function bundleBreakupWarning(bundleSize: number | undefined, action = 'doing this'): string {
  if (!bundleSize || bundleSize < 2) return ''
  const others = bundleSize - 1
  const s = others === 1 ? '' : 's'
  return ` This shift is bundled with ${others} other${s} — ${action} breaks up the bundle, ` +
    `and the other shift${s} will stay on the Wall as separate single shift${s}.`
}
