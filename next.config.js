/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '20mb' } },
  // standalone only for Docker/Vultr; Vercel uses its own bundler
  ...(process.env.DOCKER_BUILD === 'true' ? { output: 'standalone' } : {}),
  // Ensure policies YAML is included in serverless function bundles (Vercel)
  outputFileTracingIncludes: {
    '/api/analyze': ['./policies/**'],
    '/api/redteam': ['./policies/**'],
    '/api/audit':   ['./policies/**'],
  },
};

module.exports = nextConfig;
