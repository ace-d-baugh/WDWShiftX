import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'

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

  // Public prefixes, i.e. a DENYlist — everything not listed requires a session.
  //
  // This used to be the other way round: an allowlist of protected routes,
  // which fails OPEN. A new page was unprotected unless someone remembered to
  // add it, and the list had already drifted — /calendar, /messages, /boards
  // and /kanban were all missing from it. They were safe only because each
  // page happens to guard itself.
  //
  // Inverted so the default is private. Adding a page now requires a
  // deliberate act to make it public, and forgetting fails closed.
  const PUBLIC_PREFIXES = [
    '/login', '/register', '/forgot-password', '/reset-password', '/verify-email',
    '/about', '/contact', '/privacy', '/terms', '/data-deletion',
    '/for', '/survey', '/api',
  ]
  const isPublicRoute =
    pathname === '/' ||
    PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))

  const authRoutes = ['/login', '/register']
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  if (!isPublicRoute && !user) {
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

  return supabaseResponse
}

export const config = {
  // Skip static assets (any path with a file extension) — they don't need
  // auth/session refresh and were previously triggering getUser() per request.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
