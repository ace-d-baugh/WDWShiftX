import { cn } from '@/lib/utils'

interface CountPillProps {
  count: number
  /**
   * `solid` when the pill sits inside a filled control (the claimed "I'll take
   * this", the owner's Interested pill) — a purple chip on purple would vanish,
   * so it flips to a translucent white one instead.
   */
  tone?: 'default' | 'solid'
  className?: string
}

/**
 * The site's count chip: day-group headers, the Wall's tab counts and board
 * member counts all use this shape. Pulled out so the counts nested inside the
 * card action pills read the same way.
 */
export function CountPill({ count, tone = 'default', className }: CountPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5',
        'rounded-full text-[11px] font-semibold leading-none shrink-0 tabular-nums',
        tone === 'solid' ? 'bg-white/25 text-white' : 'bg-primary/15 text-primary',
        className
      )}
    >
      {count}
    </span>
  )
}
