import { CONTACT_METHOD_META } from '@/lib/contactMethods'
import type { ContactMethodType } from '@/lib/database.types'

interface ContactMethodRowProps {
  type: ContactMethodType
  value: string
}

/** Read-only display of one contact method — icon chip + linkified value where applicable. */
export function ContactMethodRow({ type, value }: ContactMethodRowProps) {
  const meta = CONTACT_METHOD_META[type]
  const Icon = meta.icon

  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center shrink-0">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-text/50">{meta.label}</p>
        {meta.hrefPrefix ? (
          <a href={`${meta.hrefPrefix}${value}`} className="text-sm font-medium text-text hover:text-primary transition-colors break-all">
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium text-text break-all">{value}</p>
        )}
      </div>
    </div>
  )
}
