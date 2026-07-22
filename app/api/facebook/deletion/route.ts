import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

function base64UrlDecode(str: string): string {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function verifySignedRequest(signedRequest: string, appSecret: string): { user_id: string } | null {
  const [encodedSig, payload] = signedRequest.split('.')
  if (!encodedSig || !payload) return null

  const expectedSig = createHmac('sha256', appSecret)
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  if (encodedSig !== expectedSig) return null

  try {
    return JSON.parse(base64UrlDecode(payload))
  } catch {
    return null
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

export async function POST(req: NextRequest) {
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appSecret) {
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }

  let signedRequest: string | null = null

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await req.text()
    const params = new URLSearchParams(body)
    signedRequest = params.get('signed_request')
  } else {
    const body = await req.json().catch(() => ({}))
    signedRequest = body.signed_request ?? null
  }

  if (!signedRequest) {
    return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 })
  }

  const data = verifySignedRequest(signedRequest, appSecret)
  if (!data) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const confirmationCode = `del_${data.user_id}_${Date.now()}`
  const statusUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://wdwshiftx.com'}/data-deletion?code=${confirmationCode}`

  return NextResponse.json({ url: statusUrl, confirmation_code: confirmationCode })
}
