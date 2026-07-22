'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  HelpCircle, ChevronDown, Send, X, CheckCircle,
  LayoutGrid, Star, UserPlus, MessageSquare,
  Bell, Monitor, Laptop, Smartphone, CalendarDays, Camera,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { sendSupportMessage } from '@/app/actions/help'

interface HelpClientProps {
  userEmail: string
  importEnabled: boolean
}

const FAQS: { q: string; a: string; importOnly?: boolean }[] = [
  {
    q: "What's the difference between a Shift Offer and a Shift Request?",
    a: "A Shift Offer means you have a shift and want someone to take it — you post the date, time, and details so others can express interest. A Shift Request means you're looking to pick up a shift — you post the date and your preferred time window so shift owners can reach out. Both appear on the Wall, separated into Offers and Requests tabs.",
  },
  {
    q: 'How do I join a board?',
    a: "You need an invite link or a 7-character invite code from someone already on the board. You can enter the code on your Profile page under My Boards → Join a Board. If someone sends you an invite link, just click it — if you're not logged in yet you'll be guided to create an account first, then land directly on the board's join page. A board moderator will review and approve your request, and you'll get an email confirmation when you're in.",
  },
  {
    q: "Why can't I see any posts on the Wall?",
    a: "You need to be an approved member of at least one board before posts appear. If you've just joined, wait for a moderator to approve your request (you'll get an email). Once approved, posts from your boards will show up. Also check the Board and Date filters — if either is active, only matching posts will display. Click 'All' on the Board filter or clear the Date filter to see everything.",
  },
  {
    q: 'How do I post a shift?',
    a: "Tap the + button on the Wall. Choose Post Shift Offer if you have a shift to give away, or Post Shift Request if you're looking to pick one up. Fill in the board, date, time, and any details, then submit. Your post goes live immediately for all members of that board to see.",
  },
  {
    q: 'How do I mark interest in a shift?',
    a: "Tap the ⭐ button on any shift card to let the owner know you're interested. They'll receive an email notification right away. You can also expand the card and leave a comment with more context — for example, if you're a good fit for that shift type or location. The post owner will see your name and can reach out directly.",
  },
  {
    q: 'How do I contact someone about a shift?',
    a: "Open the three-dot menu (⋮) on any shift or request card and choose Message — this opens a private in-app chat with the post owner where you can work out the details. There's also a Message button in the card's footer row. You can find all your conversations under Messages in the navigation, and start a new one anytime with the Start a chat button there.",
  },
  {
    q: 'Who can I message, and who can see my messages?',
    a: "You can message anyone who shares at least one board with you — the Start a chat directory on the Messages page lists everyone eligible, searchable by name and filterable by board. Conversations are private between the two of you: other board members and moderators cannot read them. Keep it professional — see the Messages section below for the ground rules.",
  },
  {
    q: 'How do I delete a chat?',
    a: "On the Messages page, tap the trash icon on a conversation and confirm. This clears the chat from your view only — the other person keeps their copy. If either of you messages again, the conversation reappears for you without the old history. To report someone who is misusing messaging, open the chat and use the three-dot menu → Flag User.",
  },
  {
    q: 'Can WDWShiftX read my work schedule from a photo?',
    a: "Yes — that's Photo Schedule Import. On the Calendar page, tap Import Schedule, then snap a photo of the posted schedule (paper or a screenshot from your scheduling app). Your shifts are read in seconds and shown next to your photo for review — you can edit, uncheck, or add rows before anything is saved, and shifts that overlap something already on your calendar are flagged. Free accounts get 4 imports per month; Pro is unlimited. See the Photo Schedule Import section below for details.",
    importOnly: true,
  },
  {
    q: 'How does shift matching work?',
    a: "When you post a shift offer, WDWShiftX automatically scans all active shift requests on the same board for the same date. If a request's preferred time window overlaps with your shift's start time, both you and the requester get an email notification about the potential match — no manual searching needed. The same happens in reverse when you post a request.",
  },
  {
    q: 'How do I report a post, comment, or user?',
    a: "Tap the three-dot menu (⋯) on any post or comment and select Flag. Describe the issue briefly and submit — a board moderator will review it. To flag a specific user, open the board member list (My Boards page), tap their three-dot menu, and choose Flag User.",
  },
  {
    q: 'How do I change my display name, timezone, or notification settings?',
    a: "Go to your Profile page (tap your name in the top navigation). From there you can update your display name, contact email, phone number, and notification preferences. Scroll down to Site Settings to change your time format, date format, timezone, and dark mode. All changes are saved automatically and sync across your devices.",
  },
  {
    q: 'How do I leave a board or delete my account?',
    a: "To leave a board, go to your Profile → My Boards, tap the × icon on the board row, and confirm. Note: if you're the only Admin on a board, you must transfer ownership to another member first — deleting or leaving without doing so would leave the board without anyone to manage it. To delete your account entirely, scroll to the Danger Zone on your Profile and tap Deactivate Account. All your posts are removed immediately and your personal data is fully purged within 30 days.",
  },
]

const PUSH_GUIDES = [
  {
    icon: Monitor,
    device: 'Windows PC',
    steps: [
      'Turn on push from Profile → Notifications → Push Notifications (or tap Enable on the Wall banner), then click Allow when your browser asks.',
      'Hearing a chime but seeing nothing? The notification went to the Notification Center — press Windows+N (or click the clock in the taskbar) to see it.',
      'To make notifications pop up on screen: open Settings → System → Notifications and turn off "Do not disturb." Also check its automatic rules — Windows often turns it on by itself during full-screen apps or screen sharing.',
      'On the same Settings page, find your browser (Chrome, Edge) in the app list, open it, and make sure "Show notification banners" is checked.',
    ],
  },
  {
    icon: Laptop,
    device: 'Mac',
    steps: [
      'Turn on push from Profile → Notifications → Push Notifications (or tap Enable on the Wall banner), then click Allow when your browser asks.',
      'Open the Apple menu → System Settings → Notifications, select your browser (Chrome, Safari, etc.), and turn on Allow Notifications.',
      'Set the alert style to "Banners" (disappears on its own) or "Alerts" (stays until dismissed).',
      'If notifications still don\'t appear, check that a Focus mode (Do Not Disturb) isn\'t on — the moon icon in the menu bar or Control Center.',
    ],
  },
  {
    icon: Smartphone,
    device: 'Android',
    steps: [
      'In Chrome, turn on push from Profile → Notifications → Push Notifications (or tap Enable on the Wall banner), then tap Allow.',
      'By default, notifications may go quietly to the notification bar without popping up over your screen.',
      'To make them pop up: press and hold a WDWShiftX notification in the tray, tap the settings gear, and set it to "Alerting" with "Pop on screen" enabled (wording varies by phone).',
      'You can also get there via Settings → Apps → Chrome → Notifications and raising the importance of the wdwshiftx.com entry.',
    ],
  },
  {
    icon: Smartphone,
    device: 'iPhone / iPad',
    steps: [
      'iPhone requires WDWShiftX to be added to your Home Screen first (iOS 16.4 or newer) — push doesn\'t work from a regular Safari tab. The app shows you these install steps on The Wall and in your Profile whenever you\'re browsing from an iPhone.',
      'In Safari, open wdwshiftx.com, tap the Share button, and choose "Add to Home Screen."',
      'Open WDWShiftX from the new Home Screen icon (not from Safari), then turn on push from Profile → Notifications → Push Notifications and tap Allow.',
      'To control how they appear: Settings → Notifications → WDWShiftX — enable Lock Screen, Notification Center, and Banners.',
    ],
  },
]

const CALENDAR_GUIDES = [
  {
    app: 'Google Calendar',
    steps: [
      'On a computer, open calendar.google.com — subscribing by URL isn\'t available in the mobile app.',
      'In the left sidebar, next to "Other calendars," click the + and choose "From URL."',
      'Paste your feed URL and click "Add calendar."',
      'Your shifts appear under Other calendars and also sync to the Google Calendar mobile app. Note: Google refreshes subscribed calendars on its own schedule, often every 6–24 hours.',
    ],
  },
  {
    app: 'Apple Calendar (iPhone / Mac)',
    steps: [
      'iPhone: Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar, then paste your feed URL.',
      'Mac: open Calendar → File → New Calendar Subscription, paste the URL, and click Subscribe.',
      'Set Auto-refresh (e.g. every hour) and choose whether it syncs via iCloud to your other Apple devices.',
    ],
  },
  {
    app: 'Outlook',
    steps: [
      'Open outlook.com (or Outlook on the web) and go to Calendar.',
      'Choose "Add calendar" → "Subscribe from web."',
      'Paste your feed URL, give it a name like WDWShiftX, and click Import.',
    ],
  },
]

export function HelpClient({ userEmail, importEnabled }: HelpClientProps) {
  const faqs = FAQS.filter(f => importEnabled || !f.importOnly)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [openGuide, setOpenGuide] = useState<number | null>(null)
  const [openCalGuide, setOpenCalGuide] = useState<number | null>(null)

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!subject.trim()) { setFormError('Please add a subject.'); return }
    if (!message.trim()) { setFormError('Please add a message.'); return }
    setSubmitting(true)
    const result = await sendSupportMessage({ fromEmail: userEmail, subject, message })
    setSubmitting(false)
    if (result.error) { setFormError(result.error); return }
    setSubmitted(true)
    setSubject('')
    setMessage('')
  }

  const handleClear = () => {
    setSubject('')
    setMessage('')
    setFormError(null)
    setSubmitted(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-accent text-2xl font-bold text-text">Help &amp; Support</h1>
          <p className="text-sm text-text/60">Everything you need to get the most out of WDWShiftX.</p>
        </div>
      </div>

      {/* ── Getting Started ──────────────────────────────────────────────────── */}
      <div className="card mb-8 bg-primary-light/40 border-primary/20">
        <h2 className="font-accent text-lg font-bold text-text mb-4">Getting Started</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: UserPlus, step: '1', title: 'Get Invited', desc: 'Ask a board manager for an invite link or 7-character code to join your first board.' },
            { icon: LayoutGrid, step: '2', title: 'Browse the Wall', desc: 'See shift offers and requests from everyone on your boards, filtered by date or board.' },
            { icon: Star,      step: '3', title: 'Post or Connect', desc: 'Post your own shifts or tap ⭐ to mark interest — the owner gets an email instantly.' },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-text">{title}</span>
                </div>
                <p className="text-xs text-text/60 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="font-accent text-xl font-bold text-text mb-4">Frequently Asked Questions</h2>
        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
          {faqs.map((faq, i) => (
            <div key={i}>
              <button
                type="button"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-text hover:bg-primary-light/30 transition-colors min-h-0 min-w-0"
                aria-expanded={openIdx === i}
              >
                <span>{faq.q}</span>
                <ChevronDown className={cn('w-4 h-4 text-text/40 shrink-0 transition-transform duration-200', openIdx === i && 'rotate-180')} />
              </button>
              {openIdx === i && (
                <div className="px-5 pb-5 text-sm text-text/70 leading-relaxed border-t border-border bg-primary-light/10">
                  <p className="pt-4">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Messages ─────────────────────────────────────────────────────────── */}
      <section className="mb-10 scroll-mt-20" id="messages">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-accent text-xl font-bold text-text">Messages</h2>
        </div>
        <p className="text-sm text-text/60 mb-4">
          Chat privately with anyone who shares a board with you — work out trade details without
          leaving the site. Find your conversations under <strong>Messages</strong> in the navigation.
        </p>
        <div className="border border-border rounded-xl px-5 py-4">
          <ul className="space-y-2.5 text-sm text-text/70 leading-relaxed list-disc list-inside">
            <li><strong>Start a chat</strong> from the ⋮ menu on any shift or request card, or from Messages → Start a chat (search by name, filter by board)</li>
            <li><strong>Read receipts:</strong> the eye icon under your message shows when the other person has opened the chat — crossed-out means not read yet</li>
            <li><strong>Reactions:</strong> tap the yellow star next to a received message to react with 👍 😂 😮 😢 😠 or a ⭐ — tap again to change it</li>
            <li><strong>Notifications:</strong> new messages show a toast at the bottom of the screen, a badge on the Messages tab, and a push notification if you have push enabled</li>
            <li><strong>Deleting a chat</strong> clears it from your view only — the other person keeps their copy, and a new message brings the chat back without the old history</li>
          </ul>
        </div>
        <div className="mt-3 text-xs text-text/60 bg-primary-light/30 border border-primary/15 rounded-lg px-4 py-3 leading-relaxed">
          <strong className="text-text/80">Keep it professional.</strong> Messaging is for work-related
          communication about shifts and scheduling. Profanity, offensive language, harassment, and spam
          aren&apos;t allowed — see our{' '}
          <Link href="/terms" className="text-primary hover:underline">Terms</Link>. If someone misuses
          messaging, open the chat and use the ⋮ menu → <strong>Flag User</strong>; misuse can lead to
          removal from the site.
        </div>
      </section>

      {/* ── Push notification setup ──────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-accent text-xl font-bold text-text">Push Notifications</h2>
        </div>
        <p className="text-sm text-text/60 mb-4">
          Get an instant alert when a shift matches or someone&rsquo;s interested in your post — even with
          the site closed. Turn them on under <strong>Profile → Notifications</strong>, then follow the steps
          for your device so alerts pop up instead of landing silently in the notification tray.
        </p>
        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
          {PUSH_GUIDES.map((guide, i) => (
            <div key={guide.device}>
              <button
                type="button"
                onClick={() => setOpenGuide(openGuide === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-text hover:bg-primary-light/30 transition-colors min-h-0 min-w-0"
                aria-expanded={openGuide === i}
              >
                <span className="flex items-center gap-2.5">
                  <guide.icon className="w-4 h-4 text-primary shrink-0" />
                  {guide.device}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-text/40 shrink-0 transition-transform duration-200', openGuide === i && 'rotate-180')} />
              </button>
              {openGuide === i && (
                <div className="px-5 pb-5 border-t border-border bg-primary-light/10">
                  <ol className="pt-4 space-y-2.5">
                    {guide.steps.map((step, si) => (
                      <li key={si} className="flex gap-2.5 text-sm text-text/70 leading-relaxed">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {si + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Calendar sync setup (Pro) ────────────────────────────────────────── */}
      {/* ── Photo Schedule Import (shown only where the feature is live) ────── */}
      {importEnabled && (
        <section className="mb-10 scroll-mt-20" id="schedule-import">
          <div className="flex items-center gap-2 mb-1">
            <Camera className="w-5 h-5 text-primary" />
            <h2 className="font-accent text-xl font-bold text-text">Photo Schedule Import</h2>
          </div>
          <p className="text-sm text-text/60 mb-4">
            Turn a photo of the posted schedule into shifts on your calendar — no retyping.
            Works with paper schedules and screenshots from scheduling apps, and it finds your
            row even on a schedule that lists the whole team. Start from{' '}
            <Link href="/calendar" className="text-primary hover:underline">Calendar → Import Schedule</Link>.
          </p>
          <div className="border border-border rounded-xl px-5 py-4">
            <ol className="space-y-2.5">
              {[
                'On the Calendar page, tap Import Schedule, then take a photo of the posted schedule or choose a screenshot. Clear, straight-on, well-lit shots read best.',
                'Your shifts appear in seconds in a review table, with your photo right above it so you can check every row without picking the schedule back up.',
                'Fix anything the reader got wrong, uncheck rows you don\'t want, or add a missed shift manually. Shifts that overlap something already on your calendar are flagged — keep the old one, replace it, or edit the times.',
                'Pick the board to add them to and confirm. Done — the shifts are on your calendar.',
              ].map((step, si) => (
                <li key={si} className="flex gap-2.5 text-sm text-text/70 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {si + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-3 text-xs text-text/60 bg-primary-light/30 border border-primary/15 rounded-lg px-4 py-3 leading-relaxed space-y-1.5">
            <p><strong className="text-text/80">Good to know:</strong> free accounts get 4 imports per month; Pro and Trial members are unlimited. Failed reads never count against your limit.</p>
            <p><strong className="text-text/80">Full-team schedules:</strong> the reader looks for your display name to pick out your row — it helps if your WDWShiftX display name matches the name on the schedule (change it on your Profile page).</p>
            <p><strong className="text-text/80">Privacy:</strong> your photo is used only to read the shifts and is never stored — not by us, and not by the AI service that processes it.</p>
          </div>
        </section>
      )}

      <section className="mb-10 scroll-mt-20" id="calendar-sync">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h2 className="font-accent text-xl font-bold text-text">Calendar Sync</h2>
          <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded">Pro</span>
        </div>
        <p className="text-sm text-text/60 mb-4">
          Pro members get a personal calendar feed URL that keeps Google Calendar, Apple Calendar, or Outlook
          in sync with their shifts automatically. Copy your feed URL from{' '}
          <Link href="/profile" className="text-primary hover:underline">Profile → Calendar Sync</Link>, then
          follow the steps for your calendar app. Treat the URL like a password — anyone who has it can see
          your shift calendar.
        </p>
        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
          {CALENDAR_GUIDES.map((guide, i) => (
            <div key={guide.app}>
              <button
                type="button"
                onClick={() => setOpenCalGuide(openCalGuide === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-text hover:bg-primary-light/30 transition-colors min-h-0 min-w-0"
                aria-expanded={openCalGuide === i}
              >
                <span>{guide.app}</span>
                <ChevronDown className={cn('w-4 h-4 text-text/40 shrink-0 transition-transform duration-200', openCalGuide === i && 'rotate-180')} />
              </button>
              {openCalGuide === i && (
                <div className="px-5 pb-5 border-t border-border bg-primary-light/10">
                  <ol className="pt-4 space-y-2.5">
                    {guide.steps.map((step, si) => (
                      <li key={si} className="flex gap-2.5 text-sm text-text/70 leading-relaxed">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {si + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Contact form ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-accent text-xl font-bold text-text mb-1">Comments &amp; Concerns</h2>
        <p className="text-sm text-text/60 mb-5">
          Can&apos;t find what you&apos;re looking for? Send us a message and we&apos;ll get back to you within 24–48 hours.
        </p>

        {submitted ? (
          <div className="card text-center space-y-3 py-8">
            <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <p className="font-accent font-bold text-text text-lg">Message sent!</p>
            <p className="text-sm text-text/60">We&apos;ll reply to <strong>{userEmail}</strong> within 24–48 hours.</p>
            <button
              onClick={handleClear}
              className="text-xs text-primary hover:underline min-h-0 min-w-0 mt-2"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            {/* From (read-only) */}
            <div>
              <label className="block text-xs font-medium text-text/60 mb-1">From</label>
              <input
                type="email"
                readOnly
                value={userEmail}
                className="input text-sm bg-primary-light/20 text-text/60 cursor-default"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-text/60 mb-1">Subject</label>
              <input
                type="text"
                className="input text-sm"
                placeholder="e.g. Question about shift matching"
                maxLength={120}
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-medium text-text/60 mb-1">Message</label>
              <textarea
                className="input text-sm min-h-[140px] resize-y"
                placeholder="Tell us what's on your mind..."
                maxLength={2000}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
              <p className="text-right text-[11px] text-text/30 mt-1">{message.length} / 2000</p>
            </div>

            {formError && (
              <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
                {formError}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleClear}>
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
              <Button type="submit" size="sm" className="gap-1.5 flex-1" loading={submitting}>
                <Send className="w-3.5 h-3.5" /> Send Message
              </Button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-text/40 mt-4">
          Prefer email?{' '}
          <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">
            support@wdwshiftx.com
          </a>
        </p>
      </section>

      {/* ── Footer links ────────────────────────────────────────────────────── */}
      <div className="mt-10 pt-6 border-t border-border flex items-center justify-center gap-4 text-xs text-text/40">
        <Link href="/privacy" className="hover:text-primary hover:underline">Privacy Policy</Link>
        <span>·</span>
        <Link href="/terms" className="hover:text-primary hover:underline">Terms &amp; Conditions</Link>
        <span>·</span>
        <Link href="/data-deletion" className="hover:text-primary hover:underline">Data Deletion</Link>
      </div>
    </div>
  )
}
