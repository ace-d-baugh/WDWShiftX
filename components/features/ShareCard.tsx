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
  /** Poster's display name, shown under the "Posted to" line. */
  posterName: string
  /** Left-border accent — the same trade/giveaway/give-trade/request color
   *  the live card's title/border-l-4 use, read live off the current theme
   *  (see themeColor() in buildWallPostShare.ts) since it varies by theme. */
  accentColor: string
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
        padding: '20px 24px',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#1a1a1a',
        boxSizing: 'border-box',
        borderLeft: `6px solid ${data.accentColor}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <img
          src="/logos/WDWShiftX-Full-Logo-Gradient.png"
          alt="WDWShiftX"
          style={{ height: 24, display: 'block' }}
        />
        {data.badges.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {data.badges.map(b => (
              <span
                key={b.label}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
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
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', lineHeight: 1.25 }}>
        {data.title}
      </h1>

      <div style={{ fontSize: 14, color: '#555', marginBottom: data.details ? 8 : 14 }}>
        {data.dateLabel} • {data.timeLabel}
      </div>

      {data.details && (
        <div
          style={{
            fontSize: 13,
            fontStyle: 'italic',
            color: '#444',
            background: '#f5f5f5',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 12,
          }}
        >
          &ldquo;{data.details}&rdquo;
        </div>
      )}

      <div style={{ textAlign: 'right', borderTop: '1px solid #eee', paddingTop: 10, marginTop: 2 }}>
        <div style={{ fontSize: 12, color: '#999' }}>Posted to WDWShiftX.com</div>
        <div style={{ fontSize: 12, color: '#999' }}>{data.boardName}</div>
        <div style={{ fontSize: 12, color: '#777', fontWeight: 600 }}>{data.posterName}</div>
      </div>
    </div>
  )
})
ShareCard.displayName = 'ShareCard'
