import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image (ADR-0012, ADR-0015).
  output: 'standalone',
}

export default nextConfig
