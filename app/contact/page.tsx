import Link from 'next/link'
import { ArrowLeft, Mail, ShieldCheck, HelpCircle } from 'lucide-react'

export const metadata = { title: 'Contact Us' }

export default async function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text/60 hover:text-text mb-8 min-h-0 min-w-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="font-accent text-3xl font-bold text-text mb-2">Contact Us</h1>
        <p className="text-text/50 text-sm mb-8">We&apos;d love to hear from you.</p>

        <div className="space-y-4">
          <div className="card shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-accent font-bold text-text mb-1">General Support</h2>
              <p className="text-sm text-text/70 mb-2">
                Questions, feedback, or trouble using WDWShiftX? Reach out and we&apos;ll get back to you.
              </p>
              <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline font-medium">
                support@wdwshiftx.com
              </a>
            </div>
          </div>

          <div className="card shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-accent font-bold text-text mb-1">Legal &amp; DMCA</h2>
              <p className="text-sm text-text/70 mb-2">
                Copyright concerns or legal inquiries related to the Service.
              </p>
              <a href="mailto:dmca@wdwshiftx.com" className="text-primary hover:underline font-medium">
                dmca@wdwshiftx.com
              </a>
            </div>
          </div>

          <div className="card shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-accent font-bold text-text mb-1">Help &amp; Support</h2>
              <p className="text-sm text-text/70 mb-2">
                Already have an account? Our in-app Help &amp; Support page covers common questions
                about boards, shifts, and notifications.
              </p>
              <Link href="/help" className="text-primary hover:underline font-medium">
                Visit Help &amp; Support
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-xs text-text/40">
          <p>WDWShiftX is operated by Digital Elegance LLC d/b/a WDWShiftX.</p>
          <p className="mt-1">We aim to respond to all inquiries within 2 business days.</p>
        </div>
      </div>
    </div>
  )
}
