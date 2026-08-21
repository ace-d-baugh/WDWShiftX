'use client'

import { useEffect, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { ShareCard, type ShareCardData } from './ShareCard'
import { ShareModal } from './ShareModal'
import { buildShareText } from '@/lib/share/buildWallPostShare'

interface ShareHandlerProps {
  data: ShareCardData
  url: string
  /** Bumped by the card's ⋮ menu to trigger a share — same tick idiom the
   *  card already uses for openCommentsTick/messageTick. */
  tick: number
}

/**
 * Renders the off-screen ShareCard, captures it to an image on each tick,
 * and tries navigator.share (with the image, then without it) before
 * falling back to the copy/download modal.
 */
export function ShareHandler({ data, url, tick }: ShareHandlerProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  // Compares against the last *value* handled, not "have I ever run" — a
  // boolean-flag guard gets defeated by React 18 StrictMode's double-invoke
  // of mount effects in dev, which would fire a share for every card on load.
  const lastTick = useRef(tick)

  useEffect(() => {
    if (tick === lastTick.current) return
    lastTick.current = tick
    void runShare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const runShare = async () => {
    const node = cardRef.current
    let blob: Blob | null = null
    if (node) {
      try {
        blob = await toBlob(node, { pixelRatio: 2, cacheBust: true })
      } catch {
        blob = null
      }
    }

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
      // Anything else (e.g. share() throwing for an unsupported combination)
      // falls through to the modal below instead of failing silently.
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
}
