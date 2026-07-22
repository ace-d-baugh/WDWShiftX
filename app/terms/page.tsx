import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Terms & Conditions' }

export default async function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text/60 hover:text-text mb-8 min-h-0 min-w-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="font-accent text-3xl font-bold text-text mb-2">Terms &amp; Conditions</h1>
        <p className="text-text/50 text-sm mb-8">Last updated: July 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-text/80">

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">1. Acceptance of Terms</h2>
            <p>
              These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of WDWShiftX,
              operated by one private individual LLC d/b/a WDWShiftX (&ldquo;WDWShiftX,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
              By creating an account or using the Service in any way, you agree to be bound by these Terms.
              If you do not agree, do not register or use the Service.
            </p>
            <p className="mt-3">
              These Terms constitute a legally binding agreement between you and WDWShiftX. We reserve the
              right to modify these Terms at any time. Material changes will be communicated via email
              before they take effect. Continued use of the Service after the effective date of any change
              constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">2. Eligibility</h2>
            <p>
              You must be at least <strong>18 years of age</strong> to use the Service. By registering,
              you represent and warrant that:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>You are at least 18 years old</li>
              <li>You have the legal capacity to enter into a binding agreement</li>
              <li>All information you provide during registration is accurate and current</li>
              <li>Your use of the Service does not violate any applicable law or regulation</li>
            </ul>
            <p className="mt-3">
              We reserve the right to refuse service to anyone and to terminate accounts that we determine,
              in our sole discretion, are ineligible under these Terms.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">3. Account Registration &amp; Security</h2>
            <p>
              When you create an account, you are responsible for maintaining the confidentiality of your
              login credentials and for all activity that occurs under your account. You agree to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Provide accurate, complete, and current registration information</li>
              <li>Immediately notify us at <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a> of any unauthorized use of your account</li>
              <li>Not share your password or allow any other person to access your account</li>
              <li>Not create more than one account per person</li>
              <li>Not create an account on behalf of another person without their explicit consent</li>
            </ul>
            <p className="mt-3">
              WDWShiftX is not liable for any loss or damage arising from your failure to maintain the
              security of your account credentials.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">4. Disclaimer of Non-Affiliation</h2>
            <p>
              WDWShiftX is an <strong>independent platform</strong> and is not affiliated with, authorized
              by, endorsed by, or in any way officially connected with any employer, theme park, resort,
              entertainment company, or any other organization whose employees may use the Service.
              All trademarks, service marks, and trade names referenced on the platform are the property
              of their respective owners.
            </p>
            <p className="mt-3">
              Any shift trades, giveaways, or arrangements facilitated through WDWShiftX are solely between
              the users involved. WDWShiftX is not a party to any employment relationship and assumes no
              responsibility for compliance with any employer&apos;s scheduling, seniority, union, or
              other workplace policies.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">5. User Conduct &amp; Prohibited Activities</h2>
            <p>You agree to use the Service lawfully and in good faith. You agree to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Post only accurate and honest shift information for shifts you personally hold and control</li>
              <li>Comply with all applicable policies and agreements with your employer regarding shift changes</li>
              <li>Treat all other users with respect</li>
            </ul>
            <p className="mt-3">You agree <strong>not</strong> to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Post shifts you do not hold, have not been assigned, or do not have authority to trade or give away</li>
              <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
              <li>Harass, threaten, intimidate, or demean any user</li>
              <li>Post false, misleading, or fraudulent information</li>
              <li>Use automated tools, bots, scrapers, or crawlers to access or collect data from the Service</li>
              <li>Reverse engineer, decompile, disassemble, or attempt to derive the source code of the Service</li>
              <li>Attempt to circumvent, disable, or interfere with security features of the Service</li>
              <li>Upload or transmit viruses, malware, or any other harmful code</li>
              <li>Collect or harvest personal information of other users without consent</li>
              <li>Engage in any activity that disrupts or interferes with the Service or servers connected to the Service</li>
              <li>Create multiple accounts to evade a suspension or ban</li>
            </ul>
            <p className="mt-3">
              <strong>Direct Messaging.</strong> The Service includes direct messaging between members
              who share a board. Messaging is provided for professional, work-related communication about
              shifts and scheduling. You agree to keep messages professional and respectful, and to avoid
              profanity, offensive, discriminatory, or sexually explicit language, harassment, unwanted
              advances, spam, and solicitation. Recipients can flag users who misuse messaging, and misuse
              may result in loss of messaging privileges, suspension, or permanent removal from the Service
              (see Section 12). WDWShiftX may review message content when investigating a flag, abuse
              report, or suspected violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">6. Shift Transactions &amp; Arrangements</h2>
            <p>
              WDWShiftX is a <strong>communication platform only</strong>. We facilitate connections between
              users who wish to trade, give away, or pick up shifts. We do not:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Guarantee that any shift arrangement will be approved by your employer</li>
              <li>Guarantee that any shift arrangement will be completed by either party</li>
              <li>Assume any responsibility for disputes arising from shift arrangements</li>
              <li>Accept any liability for disciplinary action, employment consequences, or wage loss resulting from shift arrangements made through the Service</li>
            </ul>
            <p className="mt-3">
              You are solely responsible for ensuring that any shift trade or giveaway complies with your
              employer&apos;s policies, applicable labor laws, union agreements, and any other obligations
              you may have. Always obtain proper authorization from your employer or scheduling management
              before completing a shift change.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">7. User-Generated Content</h2>
            <p>
              By posting shift offers, requests, comments, direct messages, or any other content
              (&ldquo;User Content&rdquo;) through the Service, you grant WDWShiftX a non-exclusive,
              royalty-free, worldwide license to display, distribute, and transmit that content to the
              users it is addressed to — other authorized users of the boards where it was posted, or,
              for direct messages, the other participant in the conversation — solely for the purpose
              of operating the Service.
            </p>
            <p className="mt-3">
              You represent and warrant that you own or have the necessary rights to post all User Content
              and that your User Content does not violate the rights of any third party or any applicable law.
              WDWShiftX does not claim ownership of your User Content. We reserve the right to remove any
              User Content at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">8. Intellectual Property</h2>
            <p>
              The Service and all of its original content, features, functionality, design, code, logos,
              and trademarks are and will remain the exclusive property of Digital Elegance LLC and its
              licensors. The Service is protected by copyright, trademark, and other intellectual property
              laws of the United States and international jurisdictions.
            </p>
            <p className="mt-3">
              You may not copy, modify, distribute, sell, or lease any part of the Service or its content,
              nor may you reverse engineer or attempt to extract the source code, unless you have our
              written permission or are permitted to do so by applicable law.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">9. Third-Party Services</h2>
            <p>
              WDWShiftX uses the following third-party services to operate. By using our Service, you
              acknowledge that your data may be processed by these providers in accordance with their
              own privacy policies:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Supabase</strong> — database hosting and authentication</li>
              <li><strong>Vercel</strong> — application hosting and delivery</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
            </ul>
            <p className="mt-3">
              We are not responsible for the privacy practices or content of any third-party services.
              Any links to third-party sites are provided for convenience only and do not constitute
              an endorsement.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">10. Privacy</h2>
            <p>
              Your use of the Service is also governed by our{' '}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>,
              which is incorporated into these Terms by reference. By using the Service, you consent
              to the collection and use of your information as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">11. DMCA &amp; Copyright Infringement</h2>
            <p>
              WDWShiftX respects intellectual property rights. If you believe that content on the Service
              infringes your copyright, please submit a written notice to our designated DMCA agent at{' '}
              <a href="mailto:dmca@wdwshiftx.com" className="text-primary hover:underline">dmca@wdwshiftx.com</a> that includes:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>A description of the copyrighted work you claim has been infringed</li>
              <li>A description of the infringing material and its location on our Service</li>
              <li>Your contact information (name, address, phone, email)</li>
              <li>A statement that you have a good-faith belief the use is not authorized</li>
              <li>A statement under penalty of perjury that the information is accurate and you are authorized to act on the copyright owner&apos;s behalf</li>
              <li>Your physical or electronic signature</li>
            </ul>
            <p className="mt-3">
              We will respond to valid DMCA notices and may remove or disable access to allegedly
              infringing content. Repeat infringers may have their accounts terminated.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">12. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account and access to the Service at any
              time, with or without notice, at our sole discretion, including but not limited to for
              violation of these Terms, fraudulent activity, or conduct we determine to be harmful to
              the community or to WDWShiftX.
            </p>
            <p className="mt-3">
              You may deactivate your account at any time from your Profile page. Upon deactivation, your
              posts will be removed from all boards immediately. Personal data is permanently purged from
              our systems within 30 days. Anonymized, aggregated data (such as total post counts) may be
              retained for analytics and cannot be linked back to you.
            </p>
            <p className="mt-3">
              If your account is terminated for a Terms violation, you may not create a new account
              without our prior written consent. All provisions of these Terms which by their nature
              should survive termination — including Intellectual Property, Limitation of Liability,
              Indemnification, and Dispute Resolution — shall survive.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">13. Limitation of Liability &amp; Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WDWSHIFTX DOES NOT WARRANT THAT
              THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
            <p className="mt-3">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WDWSHIFTX AND ITS OFFICERS, DIRECTORS,
              EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA,
              GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Your use of or inability to use the Service</li>
              <li>Any shift arrangement, trade, or giveaway facilitated through the Service</li>
              <li>Disciplinary action, wage loss, or employment consequences resulting from use of the Service</li>
              <li>Unauthorized access to or alteration of your transmissions or data</li>
              <li>Any third-party content or conduct on the Service</li>
            </ul>
            <p className="mt-3">
              In no event shall our total liability to you for all claims related to the Service exceed $100.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">14. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless Digital Elegance LLC, its officers,
              directors, employees, agents, and licensors from and against any claims, damages, losses,
              costs, and expenses (including reasonable attorney&apos;s fees) arising out of or related to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Your use of the Service</li>
              <li>Your User Content</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
              <li>Any shift arrangement you enter into through the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">15. Dispute Resolution &amp; Arbitration</h2>
            <p>
              <strong>Please read this section carefully — it affects your legal rights.</strong>
            </p>
            <p className="mt-3">
              You and WDWShiftX agree that any dispute, claim, or controversy arising out of or relating
              to these Terms or the Service will be resolved by <strong>binding individual arbitration</strong> administered
              by the American Arbitration Association (AAA) under its Consumer Arbitration Rules, rather
              than in court. The arbitration will be conducted in Florida or, at your option, via
              telephone or videoconference.
            </p>
            <p className="mt-3">
              <strong>Class Action Waiver:</strong> You and WDWShiftX each waive the right to a trial by
              jury and the right to participate in a class action. You may only bring claims in your
              individual capacity, not as a plaintiff or class member in any purported class or
              representative proceeding.
            </p>
            <p className="mt-3">
              <strong>Exceptions:</strong> Either party may bring claims in small claims court if they
              qualify. Either party may seek emergency injunctive relief in a court of competent jurisdiction
              to prevent irreparable harm pending arbitration.
            </p>
            <p className="mt-3">
              <strong>Opt-Out:</strong> You may opt out of this arbitration agreement within 30 days of
              first accepting these Terms by emailing{' '}
              <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a>{' '}
              with the subject line &ldquo;Arbitration Opt-Out.&rdquo; Opting out does not affect any other Terms.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">16. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of
              Florida, without regard to its conflict of law provisions. To the extent any dispute is
              not subject to arbitration under Section 15, you agree to submit to the personal and
              exclusive jurisdiction of the state and federal courts located in Florida.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">17. Force Majeure</h2>
            <p>
              WDWShiftX shall not be liable for any failure or delay in performance resulting from causes
              beyond our reasonable control, including but not limited to acts of God, natural disasters,
              pandemic, war, terrorism, riots, embargoes, acts of civil or military authorities, fire,
              floods, strikes, power outages, or failures of telecommunications or internet service providers.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">18. General Provisions</h2>
            <p>
              <strong>Severability:</strong> If any provision of these Terms is held to be invalid,
              illegal, or unenforceable, the remaining provisions will continue in full force and effect.
            </p>
            <p className="mt-3">
              <strong>No Waiver:</strong> Our failure to enforce any right or provision of these Terms
              will not be considered a waiver of that right or provision. A waiver of any provision will
              only be effective if made in writing and signed by an authorized representative of WDWShiftX.
            </p>
            <p className="mt-3">
              <strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy and any
              other policies incorporated by reference, constitute the entire agreement between you and
              WDWShiftX regarding the Service and supersede all prior agreements, understandings, and
              communications between you and us.
            </p>
            <p className="mt-3">
              <strong>Assignment:</strong> You may not assign or transfer your rights or obligations
              under these Terms without our prior written consent. We may assign our rights and
              obligations without restriction.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">19. Changes to These Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. When we make material changes,
              we will notify you by email to the address associated with your account before the changes
              take effect. The updated Terms will also be posted on this page with a revised
              &ldquo;Last updated&rdquo; date.
            </p>
            <p className="mt-3">
              Your continued use of the Service after the effective date of any update constitutes your
              acceptance of the new Terms. If you do not agree to the updated Terms, you must stop
              using the Service and may deactivate your account.
            </p>
          </section>

          <section>
            <h2 className="font-accent text-xl font-bold text-text mb-3">20. Contact Us</h2>
            <p>
              If you have questions, concerns, or feedback regarding these Terms, please contact us:
            </p>
            <ul className="list-none mt-3 space-y-1">
              <li><strong>Email:</strong> <a href="mailto:support@wdwshiftx.com" className="text-primary hover:underline">support@wdwshiftx.com</a></li>
              <li><strong>Legal / DMCA:</strong> <a href="mailto:dmca@wdwshiftx.com" className="text-primary hover:underline">dmca@wdwshiftx.com</a></li>
              <li><strong>Company:</strong> Digital Elegance LLC d/b/a WDWShiftX</li>
            </ul>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-border">
          <p className="text-xs text-text/40 text-center">
            WDWShiftX is operated by one private individual LLC and is not affiliated with, sponsored by, or endorsed by any employer or organization whose employees may use the Service.
          </p>
        </div>
      </div>
    </div>
  )
}
