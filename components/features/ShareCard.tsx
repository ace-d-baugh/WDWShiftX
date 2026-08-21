import { forwardRef } from 'react'

export interface ShareBadge {
  label: string
  bg: string
  color: string
}

export interface ShareCardData {
  type: 'shift' | 'request'
  title: string
  boardName: string
  dateLabel: string
  timeLabel: string
  details: string | null
  badges: ShareBadge[]
}

/**
 * Off-screen render target captured by html-to-image into the share image.
 * Fixed light theme and inline styles on purpose — this gets exported and
 * viewed outside the app (in a share sheet, downloaded), so it shouldn't
 * follow the viewer's site theme or depend on the app's stylesheet being
 * present in the capture.
 */
export const ShareCard = forwardRef<HTMLDivElement, { data: ShareCardData }>(({ data }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        width: 600,
        padding: 32,
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#1a1a1a',
        boxSizing: 'border-box',
      }}
    >
      <img
        src="/logos/WDWShiftX-Full-Logo-Gradient.png"
        alt="WDWShiftX"
        style={{ height: 28, marginBottom: 24, display: 'block' }}
      />

      {data.badges.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {data.badges.map(b => (
            <span
              key={b.label}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                background: b.bg,
                color: b.color,
              }}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}

      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.25 }}>
        {data.title}
      </h1>

      <div style={{ fontSize: 15, color: '#555', marginBottom: 4 }}>{data.boardName}</div>
      <div style={{ fontSize: 15, color: '#555', marginBottom: 16 }}>
        {data.dateLabel} • {data.timeLabel}
      </div>

      {data.details && (
        <div
          style={{
            fontSize: 14,
            fontStyle: 'italic',
            color: '#444',
            background: '#f5f5f5',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
          }}
        >
          &ldquo;{data.details}&rdquo;
        </div>
      )}

      <div style={{ fontSize: 12, color: '#999', borderTop: '1px solid #eee', paddingTop: 16, marginTop: 8 }}>
        Found on WDWShiftX — wdwshiftx.com
      </div>
    </div>
  )
})
ShareCard.displayName = 'ShareCard'
