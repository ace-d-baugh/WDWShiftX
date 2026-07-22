import type { MetadataRoute } from 'next'
import { INDUSTRIES } from '@/lib/landing/industries'

// Only the pages that are actually public (no login required) — everything
// else in the app sits behind an auth wall that Googlebot can't get past
// anyway, so listing those would just be noise.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://wdwshiftx.com'
  const routes = [
    '', '/login', '/register', '/about', '/contact', '/upgrade', '/terms', '/privacy', '/data-deletion',
    ...INDUSTRIES.map(i => `/for/${i.slug}`),
  ]

  return routes.map(route => ({
    url: `${base}${route}`,
    lastModified: new Date(),
  }))
}
