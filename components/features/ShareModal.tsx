'use client'

import { useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface ShareModalProps {
  open: boolean
  onClose: () => void
  imageUrl: string | null
  shareText: string
  fileName: string
}

/**
 * Fallback for browsers without navigator.share (or without file-sharing
 * support) — same copy/download shape as InviteModal's QR fallback, just for
 * a post share instead of a board invite.
 */
export function ShareModal({ open, onClose, imageUrl, shareText, fileName }: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the text and copy it manually.')
    }
  }

  const downloadImage = () => {
    if (!imageUrl) return
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = fileName
    a.click()
  }

  return (
    <Modal open={open} onClose={onClose} title="Share This Post" size="sm">
      {imageUrl && (
        <div className="mb-4 rounded-lg overflow-hidden border border-border">
          {/* Blob URL preview of the captured card — plain img, not next/image */}
          <img src={imageUrl} alt="Post preview" className="w-full" />
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={copyText}>
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Text'}
        </Button>
        {imageUrl && (
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={downloadImage}>
            <Download className="w-4 h-4" /> Download Image
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-warning mb-2">{error}</p>}

      <p className="text-xs text-text/50">
        Your device doesn&apos;t support direct sharing here — copy the text or save the image to share it yourself.
      </p>
    </Modal>
  )
}
