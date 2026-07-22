// app/layout.tsx

import type { Metadata } from 'next'
import Script from 'next/script'
import { Lato, Philosopher } from 'next/font/google'
import { CookieConsentBanner } from '@/components/features/CookieConsentBanner'
import './globals.css'

const ADSENSE_PUBLISHER_ID = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID
// Funding Choices' CMP script wants the ID without the "ca-" prefix.
const CMP_PUBLISHER_ID = ADSENSE_PUBLISHER_ID?.replace(/^ca-/, '')

export const metadata: Metadata = {
  title: {
    default: 'WDW ShiftX',
    template: '%s – WDW ShiftX',
  },
  description: 'WDW ShiftX is a private shift-trading board — post open shifts, request coverage, and organize your calendar in one place.',
  metadataBase: new URL('https://wdwshiftx.com'),
  openGraph: {
    siteName: 'WDW ShiftX',
    url: 'https://wdwshiftx.com',
    type: 'website',
    images: [
      {
        url: '/logos/WDWShiftX-Full-Logo-Gradient.png',
        alt: 'WDW ShiftX',
      },
    ],
  },
  ...(ADSENSE_PUBLISHER_ID && {
    other: { 'google-adsense-account': ADSENSE_PUBLISHER_ID },
  }),
}

const lato = Lato({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-lato',
})

const philosopher = Philosopher({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-philosopher',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${lato.variable} ${philosopher.variable}`} suppressHydrationWarning>
      <head>
        {process.env.FACEBOOK_APP_ID && (
          <meta property="fb:app_id" content={process.env.FACEBOOK_APP_ID} />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('myshiftx-theme'),c=document.documentElement.classList;if(['dark','midnight','cyberpunk','christmas','halloween'].indexOf(t)>-1)c.add('dark');if(['midnight','cyberpunk','nordic','kitty','christmas','halloween','patriotic'].indexOf(t)>-1)c.add('theme-'+t)}catch(e){}`,
          }}
        />
        {ADSENSE_PUBLISHER_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        {CMP_PUBLISHER_ID && (
          <>
            {/* Google-certified CMP (Funding Choices) — serves the EEA/UK/CH
                consent message configured in AdSense's Privacy & messaging. */}
            <Script
              async
              src={`https://fundingchoicesmessages.google.com/i/${CMP_PUBLISHER_ID}?ers=1`}
              strategy="afterInteractive"
            />
            <Script id="googlefc-present" strategy="afterInteractive">
              {`(function() {function signalGooglefcPresent() {if (!window.frames['googlefcPresent']) {if (document.body) {const iframe = document.createElement('iframe'); iframe.style = 'width: 0; height: 0; border: none; z-index: -1000; left: -1000px; top: -1000px;'; iframe.style.display = 'none'; iframe.name = 'googlefcPresent'; document.body.appendChild(iframe);} else {setTimeout(signalGooglefcPresent, 0);}}}signalGooglefcPresent();})();`}
            </Script>
          </>
        )}
      </head>
      <body className="font-sans text-text" suppressHydrationWarning>
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  )
}
