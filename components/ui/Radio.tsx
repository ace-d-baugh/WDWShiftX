'use client'

import { forwardRef, InputHTMLAttributes } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Round sibling of Checkbox: same dark-purple fill and yellow star when selected. */
const Radio = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, checked, disabled, ...props }, ref) => (
    <span className={cn('relative inline-flex h-5 w-5 shrink-0 items-center justify-center', disabled && 'opacity-50', className)}>
      <input
        type="radio"
        ref={ref}
        checked={checked}
        disabled={disabled}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1',
          checked ? 'border-primary bg-[hsl(269_35%_20%)]' : 'border-border bg-card'
        )}
      >
        <Star
          fill="#ffea80"
          strokeWidth={0}
          className={cn('h-3.5 w-3.5 text-[#FFEA80] transition-opacity', checked ? 'opacity-100' : 'opacity-0')}
        />
      </span>
    </span>
  )
)
Radio.displayName = 'Radio'
export { Radio }
