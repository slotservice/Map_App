/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@map-app/shared'],
  experimental: {
    typedRoutes: true,
  },
  // Lint runs separately via `pnpm lint`. Next 14's bundled `next lint`
  // fails with eslint 9 (removed --useEslintrc / --extensions); rather
  // than downgrade eslint workspace-wide, we gate it out of `next build`.
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [{ source: '/api/v1/:path*', destination: `${apiBase}/api/v1/:path*` }];
  },
};

export default nextConfig;
