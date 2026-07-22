import type { MetadataRoute } from 'next'

// Only the pages that are actually public (no login required) — everything
// else in the app sits behind an auth wall that Googlebot can't get past
// anyway, so listing those would just be noise.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://wdwshiftx.com'
  const routes = [
    '', '/login', '/register', '/about', '/contact', '/terms', '/privacy', '/data-deletion',
  ]

  return routes.map(route => ({
    url: `${base}${route}`,
    lastModified: new Date(),
  }))
}
