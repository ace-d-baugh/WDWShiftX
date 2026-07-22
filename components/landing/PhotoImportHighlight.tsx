import Link from 'next/link'
import { ArrowRight, Camera, ScanLine, CalendarCheck, Sparkles } from 'lucide-react'
import { AnimateIn } from '@/components/landing/AnimateIn'

interface PhotoImportHighlightProps {
  /**
   * When set (industry landing pages), the intro line is flavored for that
   * industry, e.g. "theme parks". Omit for the generic home-page copy.
   */
  industryName?: string
  /**
   * Industry-familiar scheduling apps to name-drop for instant recognition
   * (e.g. ["UKG", "Kronos", "Workday"]). Only used with industryName.
   */
  scheduleApps?: string[]
}

// "UKG, Kronos, or Workday" — Oxford-comma "or" list.
function orList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} or ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`
}

/**
 * Landing-page selling-point section for Photo Schedule Import. Render only
 * where the feature is live — gate on optionalServerEnv.GEMINI_API_KEY at the
 * call site (same flag that shows the Calendar's Import button).
 */
export function PhotoImportHighlight({ industryName, scheduleApps }: PhotoImportHighlightProps) {
  const appsPhrase = scheduleApps?.length
    ? `a screenshot from ${orList(scheduleApps)}`
    : 'a screenshot from your scheduling app'
  const intro = industryName
    ? `Schedules at ${industryName.toLowerCase()} still get retyped by hand. Not anymore: whether it's a paper printout on the wall or ${appsPhrase}, photograph it and WDWShiftX reads your shifts onto your calendar in seconds.`
    : `Stop retyping the week's schedule. Photograph the posted schedule — paper on the break-room wall or ${appsPhrase} — and WDWShiftX reads your shifts onto your calendar in seconds.`

  return (
    <section className="py-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <AnimateIn>
          <div className="card border border-primary/20 bg-gradient-to-br from-primary-light/60 via-card to-card p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">

              {/* Copy */}
              <div>
                <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  New
                </span>
                <h2 className="font-accent text-3xl md:text-4xl font-bold text-text mb-4 leading-tight">
                  Snap a Photo.<br />Your Schedule&apos;s In.
                </h2>
                <p className="text-text/70 mb-6 leading-relaxed">{intro}</p>
                <ul className="space-y-2.5 text-sm text-text/70 mb-8">
                  <li className="flex gap-2"><CalendarCheck className="w-4 h-4 text-success shrink-0 mt-0.5" /> Finds <em>your</em> row, even on a full-team schedule</li>
                  <li className="flex gap-2"><CalendarCheck className="w-4 h-4 text-success shrink-0 mt-0.5" /> You review every shift next to your photo before anything saves</li>
                  <li className="flex gap-2"><CalendarCheck className="w-4 h-4 text-success shrink-0 mt-0.5" /> Spots overlaps with shifts already on your calendar</li>
                </ul>
                <Link href="/register" className="btn btn-primary min-h-0 h-11 px-6 gap-2 group">
                  Get Started Free
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>

              {/* Steps visual */}
              <div className="space-y-4">
                {[
                  { icon: Camera, title: '1. Snap it', desc: 'Photograph the posted schedule or upload a screenshot.' },
                  { icon: ScanLine, title: '2. We read it', desc: 'Your shifts are extracted in seconds — dates, times, and roles.' },
                  { icon: CalendarCheck, title: '3. Review & done', desc: 'Confirm the shifts and they land on your calendar and boards.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-4 bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-accent font-bold text-text">{title}</p>
                      <p className="text-sm text-text/60">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  )
}
