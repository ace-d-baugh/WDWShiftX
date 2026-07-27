'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, className, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  // Portalled to <body>, so a transformed ancestor (e.g. ShiftCard's
  // hover:-translate-y-0.5) can't become the containing block for the fixed
  // overlay and shrink the dialog to the card. Mount flag keeps SSR happy.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open || !mounted) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel — capped at the viewport (minus the overlay padding) so tall
        * content scrolls inside the body instead of running offscreen. */}
      <div
        className={cn(
          'relative bg-card rounded-xl shadow-xl w-full p-6 z-10 flex max-h-full flex-col',
          sizes[size],
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="font-accent text-xl font-bold text-text">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text/40 hover:text-text hover:bg-primary-light transition-colors min-h-0 min-w-0"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {/* Body scrolls as a last resort; content that manages its own inner
          * scrolling (flex children with min-height floors) shrinks first. */}
        <div className="flex min-h-0 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  )
}
