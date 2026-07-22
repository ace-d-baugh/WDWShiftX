import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'

// EEA member states + UK + Switzerland — the regions Google's ad-consent
// requirements (and our own CookieConsentBanner suppression) target.
const EEA_UK_CH_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT',
  'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'GB', 'CH',
])

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  // Log every middleware decision in development to diagnose loops
  if (process.env.NODE_ENV === 'development') {
    const fullPath = request.nextUrl.pathname + (request.nextUrl.search || '')
    console.log(`[MW] ${fullPath} | user=${user?.email ?? 'none'} | err=${error?.message ?? 'none'}`)
  }

  const protectedRoutes = ['/dashboard', '/profile', '/wall', '/archive', '/admin', '/leader']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  const authRoutes = ['/login', '/register']
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/wall'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Vercel populates this header at the edge — no geo-IP service needed.
  // Used to defer to Google's ad-consent CMP (which now has both an EEA/UK/CH
  // message and a U.S. states message published) instead of showing our own
  // generic cookie banner to those visitors too.
  // Only set when missing or changed, so most responses carry no Set-Cookie
  // header and stay cacheable. The 24h maxAge means it re-sets once a day.
  const country = request.headers.get('x-vercel-ip-country') ?? ''
  const region = EEA_UK_CH_COUNTRIES.has(country) ? 'eea' : country === 'US' ? 'us' : 'other'
  if (request.cookies.get('wdwshiftx-region')?.value !== region) {
    supabaseResponse.cookies.set('wdwshiftx-region', region, {
      path: '/',
      maxAge: 60 * 60 * 24,
    })
  }

  return supabaseResponse
}

export const config = {
  // Skip static assets (any path with a file extension) — they don't need
  // auth/session refresh and were previously triggering getUser() per request.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
