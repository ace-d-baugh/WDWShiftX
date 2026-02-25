import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>((
  { label, error, hint, className, id, ...props },
  ref
) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text mb-1">
          {label}
          {props.required && <span className="text-warning ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'input',
          error && 'border-warning focus-visible:ring-warning',
          className
        )}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-xs text-text/40">{hint}</p>}
      {error && <p className="mt-1 text-xs text-warning">{error}</p>}
    </div>
  )
})
Input.displayName = 'Input'
export { Input }
