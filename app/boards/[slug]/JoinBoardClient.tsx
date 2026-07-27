'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, Key } from 'lucide-react'
import { lookupBoardByCode, confirmJoinBoard } from '@/app/actions/boards'
import { Button } from '@/components/ui/Button'

interface JoinBoardClientProps {
  boardId: string
  boardName: string
  boardSlug: string
  initialCode: string
}

export function JoinBoardClient({ boardName, initialCode }: JoinBoardClientProps) {
  const router = useRouter()
  const [code, setCode] = useState(initialCode.toUpperCase())
  const [step, setStep] = useState<'input' | 'confirm'>('input')
  const [foundBoard, setFoundBoard] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleLookup = async () => {
    // 7 = legacy codes, 10 = current. Both remain valid.
    if (code.length < 7 || code.length > 10) {
      setError('That invite code looks wrong — check it and try again.')
      return
    }
    setError(null)
    setLoading(true)
    const result = await lookupBoardByCode(code)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    if (result.board) { setFoundBoard(result.board); setStep('confirm') }
  }

  const handleConfirm = async () => {
    if (!foundBoard) return
    setLoading(true)
    const result = await confirmJoinBoard(foundBoard.id, true)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    setSuccess(true)
    setTimeout(() => router.push('/wall'), 2500)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Board name card */}
        <div className="card mb-6 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <LayoutGrid className="w-6 h-6 text-primary" />
          </div>
          <h1 className="font-accent text-2xl font-bold text-text mb-1">{boardName}</h1>
          <p className="text-sm text-text/60">You need an invite code to join this board.</p>
        </div>

        {success ? (
          <div className="card text-center space-y-2">
            <p className="font-medium text-success">Request sent!</p>
            <p className="text-sm text-text/60">A moderator will review your request. Redirecting to the wall…</p>
          </div>
        ) : step === 'confirm' && foundBoard ? (
          <div className="card space-y-4">
            <p className="text-sm text-text/70">
              Join <strong>{foundBoard.name}</strong>? Your request will be sent to a moderator for approval.
            </p>
            {error && <p className="text-xs text-warning">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setStep('input'); setFoundBoard(null) }}>Back</Button>
              <Button size="sm" className="flex-1" loading={loading} onClick={handleConfirm}>Request to Join</Button>
            </div>
          </div>
        ) : (
          <div className="card space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-text mb-1.5">
                <Key className="w-3.5 h-3.5 text-primary" /> Invite Code
              </label>
              <input
                type="text"
                className="input text-center text-lg font-mono tracking-[0.3em] uppercase"
                placeholder="XXXXXXX"
                maxLength={10}
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') handleLookup() }}
                autoFocus={!initialCode}
              />
              {error && <p className="mt-1.5 text-xs text-warning">{error}</p>}
            </div>
            <Button className="w-full" loading={loading} onClick={handleLookup}>
              Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
