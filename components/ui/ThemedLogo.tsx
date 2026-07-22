import Image from 'next/image'

interface ThemedLogoProps {
  /** Sizing classes (e.g. "h-12 w-auto") applied to the wrapping element. */
  className: string
  alt?: string
  priority?: boolean
}

/**
 * Full WDWShiftX logo that follows the active theme. Light and dark show the
 * gradient artwork; pro/seasonal themes (theme-* class on <html>) hide it and
 * show a solid-tinted silhouette instead. A second, independently-masked
 * "stars" layer sits on top (from a stars-only SVG extracted from the same
 * artwork — see WDWShiftX-Stars-Only-Black.svg) so themes that want a
 * different star color (Christmas, Halloween, Patriotic) can recolor just
 * the stars without needing a third logo asset — the star layer simply
 * paints over the same stars in the body layer beneath it. Themes that don't
 * care about this leave .themed-logo-stars at its default display:none.
 * See "Theme-aware logo" in globals.css.
 */
export function ThemedLogo({ className, alt = 'WDWShiftX Logo', priority }: ThemedLogoProps) {
  return (
    <span className={`themed-logo-wrap ${className}`}>
      <Image
        src="/logos/WDWShiftX-Full-Logo-Gradient.png"
        alt={alt}
        width={6200}
        height={1024}
        priority={priority}
        className="themed-logo-default"
      />
      <span role="img" aria-label={alt} className="themed-logo-tinted" />
      <span aria-hidden="true" className="themed-logo-stars" />
    </span>
  )
}
