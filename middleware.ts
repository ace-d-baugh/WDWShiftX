import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res: response })
  const { data: { session } } = await supabase.auth.getSession()

  const pathname = request.nextUrl.pathname

  // Protected routes - require auth
  const protectedRoutes = ['/dashboard', '/profile', '/board', '/archive', '/admin', '/leader']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  // Auth routes - redirect if already logged in
  const authRoutes = ['/login', '/register']
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/board', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
