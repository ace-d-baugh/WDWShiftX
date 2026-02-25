import { forwardRef, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>((
  { label, error, hint, options, placeholder, className, id, ...props },
  ref
) => {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-text mb-1">
          {label}
          {props.required && <span className="text-warning ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'input appearance-none pr-10 cursor-pointer',
            error && 'border-warning focus-visible:ring-warning',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(opt => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none" />
      </div>
      {hint && !error && <p className="mt-1 text-xs text-text/40">{hint}</p>}
      {error && <p className="mt-1 text-xs text-warning">{error}</p>}
    </div>
  )
})
Select.displayName = 'Select'
export { Select, type SelectOption }
