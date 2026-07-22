// app/layout.tsx

import type { Metadata } from 'next'
import { Lato, Philosopher } from 'next/font/google'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'WDWShiftX',
    template: '%s – WDWShiftX',
  },
  description: 'WDWShiftX is a private shift-trading web application. Employees at the same workplace use it to post open shifts, request coverage for time off, and manage their schedule from one shared, invite-only board — replacing group chats and paper sign-up sheets.',
  metadataBase: new URL('https://wdwshiftx.com'),
  openGraph: {
    siteName: 'WDWShiftX',
    url: 'https://wdwshiftx.com',
    type: 'website',
    images: [
      {
        url: '/logos/WDWShiftX-Full-Logo-Gradient.png',
        alt: 'WDWShiftX',
      },
    ],
  },
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
            __html: `try{var t=localStorage.getItem('wdwshiftx-theme'),c=document.documentElement.classList;if(['dark','midnight','cyberpunk','christmas','halloween'].indexOf(t)>-1)c.add('dark');if(['midnight','cyberpunk','nordic','kitty','christmas','halloween','patriotic'].indexOf(t)>-1)c.add('theme-'+t)}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans text-text" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
