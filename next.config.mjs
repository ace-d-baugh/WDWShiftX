/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@supabase/supabase-js',
      '@supabase/auth-helpers-nextjs',
      '@supabase/auth-helpers-shared',
      '@supabase/postgrest-js',
      '@supabase/realtime-js',
      '@supabase/storage-api',
      '@supabase/functions-js',
      '@supabase/node-fetch',
    ],
  },
}

export default nextConfig
