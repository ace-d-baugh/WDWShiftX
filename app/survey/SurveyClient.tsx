'use client'

import { useState, useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { submitSurvey, type SurveyPayload } from '@/app/actions/survey'

// ── Reusable primitives ───────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-text/40 mt-8 mb-4">
      {children}
    </p>
  )
}

function QuestionBlock({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-sm font-semibold text-text mb-1 leading-snug">{label}</p>
      {sub && <p className="text-xs text-text/50 mb-3">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </div>
  )
}

function ScaleRow({ value, onChange, lowLabel = 'Very hard', highLabel = 'Very easy' }: {
  value: number | null; onChange: (v: number) => void; lowLabel?: string; highLabel?: string
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs text-text/40 min-w-[60px]">{lowLabel}</span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={cn(
              'w-10 h-9 rounded-md border text-sm font-medium transition-colors min-h-0 min-w-0',
              value === n
                ? 'bg-primary border-primary text-white'
                : 'border-border text-text/60 hover:border-primary/50 hover:text-text bg-background'
            )}>
            {n}
          </button>
        ))}
      </div>
      <span className="text-xs text-text/40">{highLabel}</span>
    </div>
  )
}

function ChoiceGroup({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors min-h-0 min-w-0',
            value === opt.value
              ? 'bg-primary/10 border-primary text-text'
              : 'border-border text-text/70 hover:border-primary/40 hover:bg-primary-light/20 bg-background'
          )}>
          <span className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
            value === opt.value ? 'border-primary' : 'border-border')}>
            {value === opt.value && <span className="w-2 h-2 rounded-full bg-primary" />}
          </span>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function CheckGroup({ options, values, onChange }: {
  options: { value: string; label: string }[]
  values: string[]
  onChange: (values: string[]) => void
}) {
  const toggle = (v: string) => {
    const next = values.includes(v) ? values.filter(x => x !== v) : [...values, v]
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {options.map(opt => {
        const selected = values.includes(opt.value)
        return (
          <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors min-h-0 min-w-0',
              selected
                ? 'bg-primary/10 border-primary text-text'
                : 'border-border text-text/70 hover:border-primary/40 hover:bg-primary-light/20 bg-background'
            )}>
            <span className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
              selected ? 'border-primary bg-primary' : 'border-border bg-background')}>
              {selected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
            </span>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

const AWARENESS_OPTIONS = [
  { value: 'unaware', label: "Didn't know it existed" },
  { value: 'aware_unused', label: 'Knew about it, never tried it' },
  { value: 'used_liked', label: 'Tried it, liked it' },
  { value: 'used_disliked', label: "Tried it, didn't like it" },
] as const

const FEATURE_AWARENESS_ITEMS = [
  { key: 'interest_star', label: 'The ⭐ interest button on a shift or request' },
  { key: 'comments', label: 'Commenting on a post' },
  { key: 'message_from_card', label: 'Messaging a poster directly from a shift/request card' },
  { key: 'board_filters', label: 'Date and board filters on the Wall' },
  { key: 'messages_inbox', label: 'The Messages inbox (direct messages, reactions, read receipts)' },
  { key: 'push_notifications', label: 'Push notifications' },
  { key: 'dark_mode', label: 'Dark mode' },
  { key: 'my_calendar', label: 'The My Calendar page' },
  { key: 'calendar_sync', label: 'Calendar Sync — subscribing your Google/Apple/Outlook calendar (Pro/Trial only)' },
  { key: 'roadmap', label: 'The public roadmap / Kanban board of upcoming features' },
  { key: 'help_page', label: 'The Help & Support page' },
] as const

function AwarenessRow({ label, value, onChange }: {
  label: string; value: string | undefined; onChange: (v: string) => void
}) {
  return (
    <div className="mb-4 pb-4 border-b border-border/50 last:border-0 last:mb-0 last:pb-0">
      <p className="text-sm text-text/90 mb-2 leading-snug">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {AWARENESS_OPTIONS.map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={cn(
              'px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors min-h-0 min-w-0',
              value === opt.value
                ? 'bg-primary border-primary text-white'
                : 'border-border text-text/60 hover:border-primary/50 hover:text-text bg-background'
            )}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  displayName: string
}

const REQUIRED = ['ease_register', 'ease_join_board', 'ease_post_shift', 'ease_find_shifts',
  'overall_useful', 'would_replace', 'display_mode', 'primary_device', 'nps'] as const

// Submissions are fully anonymous (no user_id is ever recorded — see
// app/actions/survey.ts), so "already submitted" is tracked client-side only.
const SUBMITTED_STORAGE_KEY = 'wdwshiftx-survey-submitted'

export function SurveyClient({ displayName }: Props) {
  const [answers, setAnswers] = useState<Partial<SurveyPayload>>({
    current_method: [], wanted_features: [], appealing_pro_features: [],
    features_used: [], one_thing: '', bugs_feedback: '', open_feedback: '',
    feature_awareness: {}, testimonial: '', testimonial_consent: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(SUBMITTED_STORAGE_KEY)) {
        setAlreadySubmitted(true)
        setSubmitted(true)
      }
    } catch {}
  }, [])

  const set = <K extends keyof SurveyPayload>(key: K, val: SurveyPayload[K]) =>
    setAnswers(prev => ({ ...prev, [key]: val }))

  const requiredFilled = REQUIRED.every(k => answers[k] != null)
  const progress = Math.round(
    (REQUIRED.filter(k => answers[k] != null).length / REQUIRED.length) * 100
  )

  const handleSubmit = async () => {
    if (!requiredFilled) return
    setLoading(true)
    setError(null)
    const result = await submitSurvey(answers as SurveyPayload)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    try { localStorage.setItem(SUBMITTED_STORAGE_KEY, '1') } catch {}
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-success/15 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <h1 className="font-accent text-2xl font-bold text-text mb-3">
          {alreadySubmitted ? "You've already responded" : 'Thanks for the feedback!'}
        </h1>
        <p className="text-text/60 text-sm max-w-md mx-auto">
          {alreadySubmitted
            ? "We already have your response on file. We'll reach out if we have follow-up questions."
            : "Your answers go directly into shaping what we build next. We read every response."}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-accent text-2xl font-bold text-text mb-1">
          Hey {displayName} — help us improve WDWShiftX
        </h1>
        <p className="text-sm text-text/60 mb-4">
          Takes about 4 minutes. Every answer is read by the team building this.
        </p>
        {/* Progress bar */}
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-text/40 mt-1.5">{progress}% of required questions answered</p>
      </div>

      {/* ── Section 1: Background ── */}
      <SectionLabel>Background</SectionLabel>

      <QuestionBlock label="How have you managed shift trades up until now?" sub="Select all that apply">
        <CheckGroup values={answers.current_method ?? []} onChange={v => set('current_method', v)}
          options={[
            { value: 'facebook', label: 'Facebook group or Messenger' },
            { value: 'text', label: 'Group text / WhatsApp' },
            { value: 'paper', label: 'Paper board or bulletin board' },
            { value: 'email', label: 'Email' },
            { value: 'company-app', label: 'Company scheduling app' },
            { value: 'none', label: 'No system — just figure it out' },
          ]} />
      </QuestionBlock>

      {/* ── Section 2: First impression ── */}
      <SectionLabel>First impression</SectionLabel>

      <QuestionBlock label="What was your first impression when you opened WDWShiftX for the first time?">
        <ChoiceGroup value={answers.first_impression ?? null} onChange={v => set('first_impression', v)}
          options={[
            { value: 'impressed', label: '😄  Impressed — exactly what I was hoping for' },
            { value: 'interesting', label: '🤔  Interesting, but I had to explore to get it' },
            { value: 'confused', label: '😕  A bit confusing at first' },
            { value: 'underwhelmed', label: '😐  Underwhelmed' },
          ]} />
      </QuestionBlock>

      {/* ── Section 3: Onboarding ── */}
      <SectionLabel>Getting started</SectionLabel>

      <QuestionBlock label="How easy was it to create your account and verify your email?">
        <ScaleRow value={answers.ease_register ?? null} onChange={v => set('ease_register', v)} />
      </QuestionBlock>

      <QuestionBlock label="How easy was it to join a board once you had an invite code?">
        <ScaleRow value={answers.ease_join_board ?? null} onChange={v => set('ease_join_board', v)} />
      </QuestionBlock>

      <QuestionBlock label='Was the concept of invite-only "boards" immediately clear to you?'>
        <ChoiceGroup value={answers.boards_clarity ?? null} onChange={v => set('boards_clarity', v)}
          options={[
            { value: 'yes', label: 'Yes — made sense right away' },
            { value: 'after-exploring', label: 'Got it after a bit of exploring' },
            { value: 'still-unsure', label: 'Still not 100% sure how they work' },
            { value: 'no', label: 'No — I\'m still confused by it' },
          ]} />
      </QuestionBlock>

      {/* ── Section 4: The Wall ── */}
      <SectionLabel>The Wall</SectionLabel>

      <QuestionBlock label="How easy was it to post a shift offer or request?">
        <ScaleRow value={answers.ease_post_shift ?? null} onChange={v => set('ease_post_shift', v)} />
      </QuestionBlock>

      <QuestionBlock label="How easy was it to find shifts that matched what you were looking for?">
        <ScaleRow value={answers.ease_find_shifts ?? null} onChange={v => set('ease_find_shifts', v)} />
      </QuestionBlock>

      <QuestionBlock label="Did you use the ⭐ interest button to flag a shift?">
        <ChoiceGroup value={answers.used_interest ?? null} onChange={v => set('used_interest', v)}
          options={[
            { value: 'yes', label: 'Yes, and it worked great' },
            { value: 'yes-unclear', label: 'Yes, but I wasn\'t sure what it did' },
            { value: 'no', label: 'No' },
            { value: 'didnt-know', label: 'Didn\'t know it existed' },
          ]} />
      </QuestionBlock>

      <QuestionBlock label="Did you use the Message button to reach someone about a shift?">
        <ChoiceGroup value={answers.used_contact ?? null} onChange={v => set('used_contact', v)}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'wanted-to', label: 'Wanted to but wasn\'t sure how' },
            { value: 'no', label: 'No' },
          ]} />
      </QuestionBlock>

      {/* ── Feature discovery ── */}
      <SectionLabel>What you explored</SectionLabel>

      <QuestionBlock label="Which of these did you actually do while using WDWShiftX?" sub="Select all that apply">
        <CheckGroup values={answers.features_used ?? []} onChange={v => set('features_used', v)}
          options={[
            { value: 'browse-offers', label: 'Browsed shift offers on the Wall' },
            { value: 'browse-requests', label: 'Browsed shift requests on the Wall' },
            { value: 'posted-shift', label: 'Posted a shift offer or request' },
            { value: 'used-star', label: 'Used the ⭐ interest button on a shift' },
            { value: 'left-comment', label: 'Left a comment on a post' },
            { value: 'used-calendar', label: 'Viewed the calendar' },
            { value: 'used-filters', label: 'Used the date or board filters on the Wall' },
            { value: 'managed-board', label: 'Managed board settings or members' },
            { value: 'sent-message', label: 'Sent a direct message to another member' },
          ]} />
      </QuestionBlock>

      {/* ── Feature-by-feature awareness ── */}
      <SectionLabel>Feature by feature</SectionLabel>
      <p className="text-xs text-text/50 -mt-3 mb-4">
        The beta is wrapping up — this is our last chance to find out which features actually landed. For each one, tell us honestly whether you knew it was there.
      </p>

      {FEATURE_AWARENESS_ITEMS.map(item => (
        <AwarenessRow
          key={item.key}
          label={item.label}
          value={answers.feature_awareness?.[item.key]}
          onChange={v => set('feature_awareness', { ...(answers.feature_awareness ?? {}), [item.key]: v })}
        />
      ))}

      {/* ── Notifications ── */}
      <SectionLabel>Notifications &amp; matching</SectionLabel>

      <QuestionBlock label="Did you receive any shift match notifications?">
        <ChoiceGroup value={answers.received_notifications ?? null} onChange={v => set('received_notifications', v)}
          options={[
            { value: 'yes-useful', label: 'Yes — they were useful' },
            { value: 'yes-not-useful', label: 'Yes — but they didn\'t match what I needed' },
            { value: 'no-not-enough', label: 'No — I didn\'t post enough to trigger any' },
            { value: 'no-unexpected', label: 'No — I expected to receive one but didn\'t' },
          ]} />
      </QuestionBlock>

      {answers.received_notifications?.startsWith('yes') && (
        <QuestionBlock label="How useful were the match notifications overall?">
          <ScaleRow value={answers.notifications_helpful ?? null} onChange={v => set('notifications_helpful', v)}
            lowLabel="Not useful" highLabel="Very useful" />
        </QuestionBlock>
      )}

      {/* ── Section 5: Overall ── */}
      <SectionLabel>Overall experience</SectionLabel>

      <QuestionBlock label="How useful was WDWShiftX for your actual scheduling needs?">
        <ScaleRow value={answers.overall_useful ?? null} onChange={v => set('overall_useful', v)}
          lowLabel="Not useful" highLabel="Very useful" />
      </QuestionBlock>

      <QuestionBlock label="Would you use WDWShiftX instead of your current method of finding shift trades?">
        <ChoiceGroup value={answers.would_replace ?? null} onChange={v => set('would_replace', v)}
          options={[
            { value: 'yes-already', label: 'Yes — I\'ve already switched' },
            { value: 'yes-soon', label: 'Yes — once it improves a bit' },
            { value: 'both', label: 'Both — I\'d use WDWShiftX alongside my current method' },
            { value: 'probably-not', label: 'Probably not' },
          ]} />
      </QuestionBlock>

      <QuestionBlock label="How often do you expect to use WDWShiftX?">
        <ChoiceGroup value={answers.use_frequency ?? null} onChange={v => set('use_frequency', v)}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'few-week', label: 'A few times a week' },
            { value: 'few-month', label: 'A few times a month' },
            { value: 'rarely', label: 'Rarely — only when I really need a trade' },
          ]} />
      </QuestionBlock>

      <QuestionBlock label="How would you rate the overall speed and loading performance?">
        <ScaleRow value={answers.ease_performance ?? null} onChange={v => set('ease_performance', v)}
          lowLabel="Very slow" highLabel="Very fast" />
      </QuestionBlock>

      <QuestionBlock label="Would you use WDWShiftX more if more of your coworkers were on it?">
        <ChoiceGroup value={answers.network_effect ?? null} onChange={v => set('network_effect', v)}
          options={[
            { value: 'yes-definitely', label: 'Yes — the more people on it, the better' },
            { value: 'yes-probably', label: 'Probably — but I\'d still use it with just a few people' },
            { value: 'not-really', label: 'Not really — I just need the right people, not everyone' },
          ]} />
      </QuestionBlock>

      {/* ── Section 6: Appearance & Device ── */}
      <SectionLabel>Appearance &amp; device</SectionLabel>

      <QuestionBlock label="Which display mode did you use?">
        <ChoiceGroup value={answers.display_mode ?? null} onChange={v => set('display_mode', v)}
          options={[
            { value: 'light', label: '☀️  Light mode' },
            { value: 'dark', label: '🌙  Dark mode' },
            { value: 'both', label: 'Switched between both' },
            { value: 'didnt-know', label: 'Didn\'t know dark mode was an option' },
          ]} />
      </QuestionBlock>

      <QuestionBlock label="What device did you primarily use?">
        <ChoiceGroup value={answers.primary_device ?? null} onChange={v => set('primary_device', v)}
          options={[
            { value: 'phone', label: '📱  Phone (iOS or Android)' },
            { value: 'desktop', label: '💻  Desktop or laptop' },
            { value: 'tablet', label: '🖥️  Tablet' },
            { value: 'mix', label: 'Mix of devices' },
          ]} />
      </QuestionBlock>

      {/* ── Section 7: Features & Pricing ── */}
      <SectionLabel>Features &amp; pricing</SectionLabel>

      <QuestionBlock label="Which upcoming features would you find most useful?" sub="Select all that apply">
        <CheckGroup values={answers.wanted_features ?? []} onChange={v => set('wanted_features', v)}
          options={[
            { value: 'push', label: 'Push notifications for shift matches' },
            { value: 'messaging', label: 'In-app messaging with board members' },
            { value: 'photo-import', label: 'Photo schedule import — photograph your schedule to auto-add shifts' },
            { value: 'calendar-sync', label: 'Calendar sync (Google, Apple, Outlook)' },
            { value: 'trade-prefs', label: 'Set trade preferences — only get notified for shifts that fit your schedule' },
            { value: 'bulk-import', label: 'Bulk schedule import (CSV or multi-week photo)' },
            { value: 'mobile-app', label: 'Native mobile app (iOS / Android)' },
            { value: 'availability', label: 'Set availability / blackout dates' },
            { value: 'recurring', label: 'Recurring shift templates' },
          ]} />
      </QuestionBlock>

      <QuestionBlock label="WDWShiftX will offer a paid Pro plan with no ads, SMS notifications, and advanced features. Would you pay for it?">
        <ChoiceGroup value={answers.would_pay ?? null} onChange={v => set('would_pay', v)}
          options={[
            { value: 'yes-right-now', label: 'Yes — I\'d upgrade right now' },
            { value: 'yes-if-improved', label: 'Yes — once the app improves more' },
            { value: 'depends-price', label: 'Depends on the price' },
            { value: 'free-only', label: 'No — I\'d only use the free version' },
          ]} />
      </QuestionBlock>

      {answers.would_pay && answers.would_pay !== 'free-only' && (
        <>
          <QuestionBlock label="What's the most you'd comfortably pay per month?">
            <ChoiceGroup value={answers.appealing_pro_features?.[0] ?? null}
              onChange={v => set('appealing_pro_features', [v])}
              options={[
                { value: 'under-3', label: 'Under $3/mo' },
                { value: '3-6', label: '$3–$6/mo' },
                { value: '6-10', label: '$6–$10/mo' },
                { value: 'over-10', label: 'Over $10/mo if the features are worth it' },
              ]} />
          </QuestionBlock>
        </>
      )}

      {/* ── Section 8: Open-ended ── */}
      <SectionLabel>Open feedback</SectionLabel>

      <QuestionBlock label="If you could change just ONE thing about WDWShiftX right now, what would it be?">
        <textarea
          value={answers.one_thing}
          onChange={e => set('one_thing', e.target.value)}
          placeholder="The single most important change..."
          className="input text-sm min-h-[70px] resize-y"
        />
      </QuestionBlock>

      <QuestionBlock label="Was anything broken, confusing, or frustrating?">
        <textarea
          value={answers.bugs_feedback}
          onChange={e => set('bugs_feedback', e.target.value)}
          placeholder="Describe any moments where you got stuck or something didn't work..."
          className="input text-sm min-h-[90px] resize-y"
        />
      </QuestionBlock>

      <QuestionBlock label="Would you recommend WDWShiftX to a coworker?">
        <ChoiceGroup value={answers.nps ?? null} onChange={v => set('nps', v)}
          options={[
            { value: 'definitely', label: '💬  Definitely — I\'d tell them today' },
            { value: 'probably', label: '👍  Probably — once it\'s a bit more polished' },
            { value: 'unsure', label: '🤔  Not sure yet' },
            { value: 'no', label: '👎  Probably not' },
          ]} />
      </QuestionBlock>

      <QuestionBlock label="Anything else you'd like us to know?">
        <textarea
          value={answers.open_feedback}
          onChange={e => set('open_feedback', e.target.value)}
          placeholder="Ideas, praise, complaints — all welcome here."
          className="input text-sm min-h-[90px] resize-y"
        />
      </QuestionBlock>

      {/* ── Section 9: Testimonial ── */}
      <SectionLabel>One last thing</SectionLabel>

      <QuestionBlock
        label="Would you like to leave a short testimonial?"
        sub="Completely optional — if you're up for it, this may be featured on the WDWShiftX homepage in the future."
      >
        <textarea
          value={answers.testimonial}
          onChange={e => set('testimonial', e.target.value)}
          placeholder="What would you tell a coworker about WDWShiftX?"
          className="input text-sm min-h-[80px] resize-y"
        />
        {answers.testimonial && answers.testimonial.trim().length > 0 && (
          <label className="mt-3 flex items-start gap-2.5 text-xs text-text/60 cursor-pointer">
            <input
              type="checkbox"
              checked={answers.testimonial_consent ?? false}
              onChange={e => set('testimonial_consent', e.target.checked)}
              className="mt-0.5"
            />
            It&rsquo;s okay to feature this quote publicly (shown anonymously — the survey doesn&rsquo;t collect your name).
          </label>
        )}
      </QuestionBlock>

      {/* Submit */}
      <div className="mt-8 pt-6 border-t border-border">
        {error && (
          <p className="text-xs text-warning mb-3">{error}</p>
        )}
        {!requiredFilled && (
          <p className="text-xs text-text/40 mb-3">
            Answer all required questions ({REQUIRED.length - REQUIRED.filter(k => answers[k] != null).length} remaining) to submit.
          </p>
        )}
        <Button
          onClick={handleSubmit}
          loading={loading}
          disabled={!requiredFilled}
          className="gap-1.5"
        >
          Submit feedback
        </Button>
      </div>

    </div>
  )
}
