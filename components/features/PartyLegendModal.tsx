'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ALL_SPECIAL_EVENT_BADGES } from '@/lib/special-events'

interface PartyLegendModalProps {
  open: boolean
  onClose: () => void
}

/**
 * What the MNSSHP/HHN/MVMCP emoji on the Wall and Calendar actually mean —
 * always all three, regardless of which badge was tapped to open it, since
 * this is a legend rather than a per-day detail. Modal already closes via
 * its own X, the backdrop, and Esc; a Close button below is the second exit
 * the emoji click was asked to have.
 */
export function PartyLegendModal({ open, onClose }: PartyLegendModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Party Legend" size="sm">
      <ul className="space-y-3">
        {ALL_SPECIAL_EVENT_BADGES.map(badge => (
          <li key={badge.shortLabel} className="flex items-center gap-3">
            <span role="img" aria-label={badge.label} className="text-2xl leading-none shrink-0">
              {badge.emoji}
            </span>
            <span className="text-sm text-text">
              {badge.label} <span className="text-text/50">({badge.shortLabel})</span>
            </span>
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="w-full mt-5" onClick={onClose}>
        Close
      </Button>
    </Modal>
  )
}
