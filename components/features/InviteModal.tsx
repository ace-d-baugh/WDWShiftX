'use client'

import { useState } from 'react'
import { Check, Copy, Download, RefreshCw, AlertTriangle } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wdwshiftx.com'

interface InviteModalProps {
  open: boolean
  onClose: () => void
  boardName: string
  boardSlug: string
  inviteCode: string
  inviteCodeEnabled: boolean
  /** Whether to show the "Accept new members" toggle + regenerate controls. */
  isLeader: boolean
  onToggleEnabled: () => Promise<{ error?: string }>
  onRegenerate: () => Promise<{ code?: string; error?: string }>
}

/**
 * Shared invite modal: big invite code + copy (profile's original design),
 * QR code + download, shareable link + copy, and — for Leaders/Admin only —
 * the "Accept new members" toggle and regenerate-code flow. Used from the
 * Boards page, an individual board page (same BoardsClient), and Profile's
 * My Boards section, so the invite experience is identical everywhere.
 */
export function InviteModal({
  open, onClose, boardName, boardSlug, inviteCode, inviteCodeEnabled, isLeader,
  onToggleEnabled, onRegenerate,
}: InviteModalProps) {
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [toggleLoading, setToggleLoading] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
  const [regenConfirm, setRegenConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inviteUrl = `${BASE_URL}/boards/${boardSlug}?c=${inviteCode}`

  const close = () => {
    setRegenConfirm(false)
    setError(null)
    onClose()
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      setError('Could not copy — select the code and copy it manually.')
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setError('Could not copy — select the link and copy it manually.')
    }
  }

  const downloadQR = () => {
    const canvas = document.getElementById('invite-qr-canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${boardName}-invite.png`
    a.click()
  }

  const handleToggle = async () => {
    setToggleLoading(true)
    setError(null)
    const result = await onToggleEnabled()
    setToggleLoading(false)
    if (result.error) setError(result.error)
  }

  const handleRegen = async () => {
    setRegenLoading(true)
    setError(null)
    const result = await onRegenerate()
    setRegenLoading(false)
    if (result.error) { setError(result.error); return }
    setRegenConfirm(false)
  }

  return (
    <Modal open={open} onClose={close} size="sm">
      <h3 className="font-accent font-bold text-text text-lg mb-1">{boardName}</h3>
      <p className="text-xs text-text/50 mb-4">Invite Code</p>

      {!inviteCodeEnabled && (
        <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          This invite code is currently paused. It won&apos;t work until {isLeader ? 're-enabled below' : 'a board Admin re-enables it'}.
        </div>
      )}

      {/* Big code + copy */}
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-3xl font-bold tracking-[0.3em] text-primary select-all">
          {inviteCode}
        </span>
        <button
          onClick={copyCode}
          className="p-1.5 rounded-md text-text/40 hover:text-primary hover:bg-primary-light transition-colors min-h-0 min-w-0"
          aria-label="Copy invite code"
        >
          {codeCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {/* QR code */}
      <div className="flex flex-col items-center gap-3 mb-4">
        <div className="p-3 bg-white rounded-lg shadow-sm border border-border">
          <QRCodeCanvas id="invite-qr-canvas" value={inviteUrl} size={160} marginSize={1} />
        </div>
        <button
          onClick={downloadQR}
          className="flex items-center gap-1.5 text-xs text-text/60 hover:text-primary transition-colors min-h-0 min-w-0"
        >
          <Download className="w-3.5 h-3.5" /> Download QR Code
        </button>
      </div>

      {/* Invite URL */}
      <div className="flex gap-2 mb-4">
        <input
          readOnly
          value={inviteUrl}
          className="input text-xs flex-1 text-text/70 bg-background"
          onClick={e => (e.target as HTMLInputElement).select()}
        />
        <Button
          size="sm"
          variant={linkCopied ? 'secondary' : 'outline'}
          className="shrink-0 gap-1.5"
          onClick={copyLink}
        >
          <Copy className="w-3.5 h-3.5" />
          {linkCopied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      {/* Instructions */}
      <div className="p-3 rounded-lg bg-primary-light/40 space-y-1.5 text-xs text-text/70 mb-4">
        <p className="font-semibold text-text">How to share:</p>
        <p>• Copy the code or link above and send it directly to the person.</p>
        <p>• Or download the QR code and share it — they can scan it to join.</p>
        <p className="font-semibold text-warning mt-2">⚠ Only share with people you know and trust. Anyone with this code can request to join the board.</p>
      </div>

      {error && <p className="text-xs text-warning mb-3">{error}</p>}

      {isLeader && (
        <>
          <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-primary-light/30">
            <div>
              <p className="text-sm font-medium text-text">Accept new members</p>
              <p className="text-xs text-text/50">{inviteCodeEnabled ? 'Code is active' : 'Code is paused'}</p>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggleLoading}
              role="switch"
              aria-checked={inviteCodeEnabled}
              aria-label="Toggle invite code"
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0',
                inviteCodeEnabled ? 'bg-primary' : 'bg-border'
              )}
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                  inviteCodeEnabled ? 'translate-x-5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>

          {!regenConfirm ? (
            <button
              onClick={() => setRegenConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-text/50 hover:text-warning transition-colors min-h-0 min-w-0"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Generate a new code (invalidates this link, code &amp; QR)
            </button>
          ) : (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 space-y-2">
              <p className="text-xs text-warning font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                This will invalidate the current code, link, and QR.
              </p>
              <p className="text-xs text-text/60">Anyone who has already saved the old one will no longer be able to use it.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setRegenConfirm(false)}>Cancel</Button>
                <Button variant="danger" size="sm" className="flex-1" loading={regenLoading} onClick={handleRegen}>
                  Generate New Code
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
