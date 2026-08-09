import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { displayNameRegex } from '@/lib/validations/auth'
import { REGISTRATION_PAUSED } from '@/lib/registration'

function formatOAuthDisplayName(meta: Record<string, unknown>): string | null {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  let firstPart = ''
  let lastPart  = ''

  const given  = str(meta.given_name)
  const family = str(meta.family_name)

  if (given && family) {
    firstPart = given
    lastPart  = family
  } else {
    // Fall back to full_name or name ("Tyrell Erfunden" → "Tyrell" + "Erfunden")
    const full = str(meta.full_name) || str(meta.name)
    if (!full) return null
    const lastSpace = full.lastIndexOf(' ')
    if (lastSpace === -1) return null
    firstPart = full.slice(0, lastSpace)
    lastPart  = full.slice(lastSpace + 1)
  }

  if (!firstPart || !lastPart) return null

  // Capitalise each word, preserving hyphens (e.g. "Mary Ann", "Jean-Pierre")
  const formatName = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .map(part =>
        part.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-')
      )
      .join(' ')

  return `${formatName(firstPart)} ${formatName(lastPart)}`
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? ''

  if (code) {
    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Registration-paused enforcement: the register page only blocks the
        // email form + hides the OAuth buttons there, but Supabase's OAuth
        // exchange above already authenticates via the /login page's OAuth
        // buttons too — and creates a brand-new account via the handle_new_user
        // trigger if this email has never signed in before. Since we can't
        // stop that DB-level account creation from here, we instead refuse to
        // hand the new account a live session: sign back out and bounce to
        // /register, same as the email flow.
        //
        // created_at ≈ last_sign_in_at (within a few seconds) is the standard
        // Supabase signal for "this is this account's very first session ever" —
        // for a returning user those timestamps are seconds/days/years apart.
        const isNewAccount = Math.abs(
          new Date(user.created_at).getTime() -
          new Date(user.last_sign_in_at ?? user.created_at).getTime()
        ) < 10_000

        if (REGISTRATION_PAUSED && isNewAccount) {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/register?oauth_blocked=1`)
        }

        const { data: profile } = await supabase
          .from('users')
          .select('display_name, email')
          .eq('id', user.id)
          .single()

        let hasName = !!(
          profile?.display_name &&
          profile.display_name !== 'User' &&
          displayNameRegex.test(profile.display_name)
        )

        // If no valid display name yet, try to derive one from OAuth metadata
        const oauthProviders = ['google', 'facebook']
        if (!hasName && oauthProviders.includes(user.app_metadata?.provider ?? '')) {
          const meta = (user.user_metadata ?? {}) as Record<string, unknown>
          const derived = formatOAuthDisplayName(meta)

          if (derived && displayNameRegex.test(derived)) {
            // Upsert so this works for both new and existing users
            await supabase.from('users').upsert({
              id: user.id,
              email: user.email ?? profile?.email ?? '',
              display_name: derived,
              email_verified: true,
              role: 'Guest',
              is_active: true,
            }, { onConflict: 'id' })

            hasName = true
          }
        }

        // Only allow relative paths starting with / to prevent open-redirect attacks.
        // Reject protocol-relative URLs (//evil.com), absolute URLs, and empty strings.
        const safePath = next && /^\/[^/]/.test(next) ? next : '/wall'
        const destination = hasName ? `${origin}${safePath}` : `${origin}/profile?oauth=1`
        return NextResponse.redirect(destination)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`)
}
