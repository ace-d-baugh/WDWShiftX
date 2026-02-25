// Email sending route - configure with your email provider
export async function POST() {
  // TODO: Configure email provider (e.g., Resend, SendGrid)
  return Response.json({ message: 'Email service not configured' }, { status: 501 })
}
