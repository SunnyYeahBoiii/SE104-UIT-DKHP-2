import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image (ADR-0012, ADR-0015).
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  // Same-origin API: nginx does this in production (ADR-0012); Next does it in local dev.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_ORIGIN ?? 'http://127.0.0.1:3001'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
