'use client'

import { ChevronDown, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Below this many results, letter-sectioning and the jump bar are both more
 *  friction than help — a flat list is faster to scan than hunting for a
 *  section header. */
export const ALPHA_GROUPING_THRESHOLD = 25

/** Which letter-section a sort key falls under: '#' for anything not starting
 *  with A-Z (digits, symbols, empty), else that uppercase letter. */
export function letterBucket(key: string): string {
  const ch = (key || '').trim().charAt(0).toUpperCase()
  return ch >= 'A' && ch <= 'Z' ? ch : '#'
}

/** Case-insensitive, ASCII-order comparison — deliberately not localeCompare,
 *  whose default collation doesn't reliably keep digits sorting before letters
 *  the way a plain code-unit comparison does. That ordering is what makes
 *  "numbers first, then A-Z" fall out of a plain ascending sort for free,
 *  and reverse cleanly (Z...A, # last) under descending. */
export function compareStrings(a: string, b: string, direction: 'asc' | 'desc'): number {
  const au = a.toUpperCase()
  const bu = b.toUpperCase()
  const cmp = au < bu ? -1 : au > bu ? 1 : 0
  return direction === 'asc' ? cmp : -cmp
}

/** Buckets an already-sorted array into a Map keyed by letterBucket(keyFn(item)).
 *  Map insertion order follows the array's order, so the sections come out
 *  already in the right order for whichever sort direction produced it. */
export function groupByLetter<T>(sorted: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of sorted) {
    const key = letterBucket(keyFn(item))
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

// ── Letter-section accordion ─────────────────────────────────────────────────
// Same grid-template-rows collapse trick as the Wall's DayGroup, so a section
// with a lot of rows in it can be folded away without an abrupt height snap.

export function LetterSection({
  sectionKey, letter, count, isCollapsed, onToggle, sectionRef, children,
  scrollMarginClass = 'scroll-mt-[120px]',
}: {
  sectionKey: string
  letter: string
  count: number
  isCollapsed: boolean
  onToggle: () => void
  sectionRef: (el: HTMLDivElement | null) => void
  children: React.ReactNode
  /** Clearance above the section when the jump bar scrolls to it, so it
   *  doesn't land tucked underneath sticky navbar/tabs — varies per surface. */
  scrollMarginClass?: string
}) {
  return (
    <div
      ref={sectionRef}
      id={`alpha-${sectionKey}`}
      className={cn(scrollMarginClass, 'rounded-xl border border-border overflow-hidden')}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-primary-light/30 hover:bg-primary-light/50 transition-colors duration-150 min-h-0"
        aria-expanded={!isCollapsed}
      >
        <span className="flex items-center gap-2.5">
          <span className="font-accent font-bold text-text text-sm w-4 text-center">{letter}</span>
          <span className="text-[11px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full shrink-0 leading-none">
            {count}
          </span>
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-text/40 transition-transform duration-300 ease-spring shrink-0',
          !isCollapsed && 'rotate-180'
        )} />
      </button>
      <div className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-spring',
        isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
      )}>
        <div className="overflow-hidden">
          <div className="p-3 space-y-2">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ── Vertical A-Z(#) jump bar ─────────────────────────────────────────────────
// Sits to the right of the results, sticky, its buttons stretching (flex-1) to
// fill whatever height the results column ends up being — "spanning the
// vertical space" — rather than clumping at the top. Only rendered by callers
// once the result count clears ALPHA_GROUPING_THRESHOLD.

// `open` toggles the bar's own width (32px/36px → 0) with overflow-hidden on
// this same element clipping its own letters as they shrink out of view —
// squishing the results column over without a popping in/out. Deliberately
// NOT a separate wrapping div: any ANCESTOR with overflow other than fully
// 'visible' on both axes disables position:sticky for everything inside it
// (per spec, setting only overflow-x also computes overflow-y as 'auto', not
// 'visible', so even "overflow-x-hidden" on a wrapper breaks it — confirmed
// the hard way). Overflow-hidden on the sticky element ITSELF only clips its
// own children and doesn't affect whether the element sticks, so the
// transition and the clipping both have to live on this one node.
export function VerticalJumpBar({
  letters, groups, onJump, open = true, stickyTopClass = 'top-[168px]', maxHeightClass = 'max-h-[calc(100vh-200px)]',
}: {
  letters: string[]
  groups: Map<string, unknown[]>
  onJump: (letter: string) => void
  /** Show/hide via the panel toggle — defaults open for callers that don't
   *  offer a toggle at all. */
  open?: boolean
  stickyTopClass?: string
  maxHeightClass?: string
}) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        'sticky flex flex-col shrink-0 gap-px py-1 overflow-hidden transition-[width] duration-300 ease-spring',
        open ? 'w-8 sm:w-9' : 'w-0',
        stickyTopClass, maxHeightClass
      )}
    >
      {letters.map(letter => {
        const has = groups.has(letter)
        return (
          <button
            key={letter}
            type="button"
            tabIndex={open ? 0 : -1}
            disabled={!has}
            onClick={() => onJump(letter)}
            className={cn(
              'flex-1 min-h-0 min-w-[2rem] sm:min-w-[2.25rem] rounded text-sm font-bold flex items-center justify-center transition-colors',
              has ? 'text-primary hover:bg-primary-light/70 active:bg-primary-light cursor-pointer' : 'text-text/20 cursor-default'
            )}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}

// ── Jump bar show/hide toggle ────────────────────────────────────────────────
// Icon reflects the action a tap performs next: panel-right-open while
// closed (tap to reveal), panel-right-close while open (tap to hide).

export function JumpPanelToggle({ open, onClick, className }: {
  open: boolean
  onClick: () => void
  className?: string
}) {
  const Icon = open ? PanelRightClose : PanelRightOpen
  return (
    <button
      type="button"
      onClick={onClick}
      title={open ? 'Hide jump bar' : 'Show jump bar'}
      aria-pressed={open}
      className={cn(
        'flex items-center justify-center shrink-0 min-h-0 min-w-0 p-1.5 rounded text-text/60 hover:text-primary hover:bg-primary-light/50 transition-colors cursor-pointer',
        className
      )}
    >
      <Icon className="w-5 h-5" />
    </button>
  )
}

// ── A-Z / Z-A sort toggle ─────────────────────────────────────────────────────

export function SortToggleButton({ direction, onClick, Icon, ReverseIcon, showLabel = true }: {
  direction: 'asc' | 'desc'
  onClick: () => void
  Icon: React.ComponentType<{ className?: string }>
  ReverseIcon: React.ComponentType<{ className?: string }>
  /** The icon alone (arrow-down-a-z vs arrow-down-z-a) already conveys the
   *  direction — callers tight on horizontal space (a full-width search row)
   *  can drop the redundant "A → Z" text and keep just the icon button. */
  showLabel?: boolean
}) {
  const ActiveIcon = direction === 'asc' ? Icon : ReverseIcon
  return (
    <button
      type="button"
      onClick={onClick}
      title={direction === 'asc' ? 'Sorting A to Z — tap to reverse' : 'Sorting Z to A — tap to reverse'}
      className={cn(
        'input text-sm h-9 flex items-center justify-center gap-1.5 min-h-0 hover:bg-primary-light/40 transition-colors cursor-pointer shrink-0',
        !showLabel && 'w-9 px-0'
      )}
    >
      <ActiveIcon className="w-4 h-4 shrink-0" />
      {showLabel && (direction === 'asc' ? 'A → Z' : 'Z → A')}
    </button>
  )
}
