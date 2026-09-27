'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { ShareCard, type ShareCardData } from './ShareCard'
import { ShareModal } from './ShareModal'
import { buildShareText } from '@/lib/share/buildWallPostShare'

interface ShareHandlerProps {
  data: ShareCardData
  url: string
}

export interface ShareHandlerRef {
  share: () => void
}

/**
 * Renders the off-screen ShareCard and keeps a captured image ready in the
 * background (re-captured whenever `data` changes), so `share()` can call
 * navigator.share() synchronously the moment it's invoked. iOS Safari only
 * honors navigator.share() while the tap that triggered it is still "live" —
 * routing the call through an awaited image capture (or through a tick prop
 * bounced through a separate effect) reliably loses that window, which is
 * what was silently dropping owners into the copy/download fallback modal.
 */
export const ShareHandler = forwardRef<ShareHandlerRef, ShareHandlerProps>(function ShareHandler(
  { data, url },
  ref
) {
  const cardRef = useRef<HTMLDivElement>(null)
  const blobRef = useRef<Blob | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Background capture — not tied to the share tap, so it never sits between
  // the click and the navigator.share() call.
  useEffect(() => {
    let cancelled = false
    blobRef.current = null
    const node = cardRef.current
    if (!node) return
    toBlob(node, { pixelRatio: 2, cacheBust: true })
      .then(blob => { if (!cancelled) blobRef.current = blob })
      .catch(() => { if (!cancelled) blobRef.current = null })
    return () => { cancelled = true }
  }, [data])

  useImperativeHandle(ref, () => ({
    share: () => { void runShare() },
  }))

  const runShare = async () => {
    const blob = blobRef.current
    const text = buildShareText(data, url)
    const file = blob ? new File([blob], 'wdwshiftx-post.png', { type: 'image/png' }) : null

    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: data.title, text, url })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: data.title, text, url })
        return
      }
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return
      // Anything else (e.g. share() throwing for an unsupported combination,
      // or activation expiring) falls through to the modal below instead of
      // failing silently.
    }

    setImageUrl(blob ? URL.createObjectURL(blob) : null)
    setModalOpen(true)
  }

  return (
    <>
      {/* Off-screen — not display:none, html-to-image needs real layout to capture */}
      <div style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }} aria-hidden="true">
        <ShareCard ref={cardRef} data={data} />
      </div>
      <ShareModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        imageUrl={imageUrl}
        shareText={buildShareText(data, url)}
        fileName={`wdwshiftx-${data.type}.png`}
      />
    </>
  )
})
