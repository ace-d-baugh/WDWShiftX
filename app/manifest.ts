import type { MetadataRoute } from 'next'

// Web app manifest — required for iOS Safari push notifications (iOS 16.4+
// only delivers push to sites added to the Home Screen, which needs a
// manifest with standalone display). Also enables install on Android/desktop.
// app/apple-icon.png doubles as the iOS Home Screen icon via the
// apple-touch-icon link Next.js generates for it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WDWShiftX',
    short_name: 'WDWShiftX',
    description: 'WDWShiftX is a private shift-trading web application: employees at the same workplace post open shifts, request coverage for time off, and manage their schedule from one shared, invite-only board.',
    start_url: '/wall',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/apple-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
