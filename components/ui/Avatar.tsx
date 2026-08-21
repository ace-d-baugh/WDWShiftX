'use client'

import { useState } from 'react'
import { User } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

interface AvatarProps {
  avatarUrl?: string | null
  displayName?: string | null
  /** Diameter in px. */
  size?: number
  className?: string
  /** Color applied to the fallback icon/initials when there's no image —
   *  callers pass their existing type/accent color to keep that language
   *  (e.g. ShiftCard's trade/giveaway hue) when there's nothing to show yet. */
  tintClassName?: string
  /** Clicking an image avatar opens a lightbox. No-op on the fallback state. */
  clickable?: boolean
}

function initialsFrom(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0][0]!.toUpperCase()
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase()
}

export function Avatar({
  avatarUrl, displayName, size = 32, className, tintClassName = 'text-primary', clickable = true,
}: AvatarProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const dimension = { width: size, height: size }
  const alt = displayName ? `${displayName}'s profile picture` : 'Profile picture'

  if (avatarUrl) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- real remote Storage URL, but this app doesn't use next/image anywhere; staying consistent */}
        <img
          src={avatarUrl}
          alt={alt}
          style={dimension}
          onClick={clickable ? () => setLightboxOpen(true) : undefined}
          className={cn(
            'rounded-full object-cover shrink-0 bg-primary-light',
            clickable && 'cursor-pointer',
            className
          )}
        />
        {clickable && (
          <Modal open={lightboxOpen} onClose={() => setLightboxOpen(false)} size="md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={alt} className="w-full h-auto rounded-lg" />
          </Modal>
        )}
      </>
    )
  }

  const initials = initialsFrom(displayName)
  // Fit to the two sizes actually in use — Profile's 40px circle wants ~28px
  // text, the Wall's 20px circle wants ~12px — rather than a flat proportion
  // of size, which undersized the small spots and left the large one small too.
  const initialsFontSize = Math.round(Math.max(size * 0.8 - 4, 10))
  return (
    <span
      style={dimension}
      className={cn(
        'rounded-full bg-primary-light flex items-center justify-center shrink-0 font-semibold',
        tintClassName,
        className
      )}
    >
      {initials
        ? (
          // lineHeight: 1 — text's default line box is taller than the glyph
          // itself, which throws off the parent's flex-centering and makes
          // initials sit visibly high in the circle.
          <span className="flex items-center justify-center" style={{ fontSize: initialsFontSize, lineHeight: 1 }}>
            {initials}
          </span>
        )
        : <User size={size * 0.55} />}
    </span>
  )
}
