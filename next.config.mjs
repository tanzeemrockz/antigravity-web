/** @type {import('next').NextConfig} */
const NEST_BACKEND_URL = process.env.NEST_BACKEND_URL || 'https://wide-quilt-warranties-manager.trycloudflare.com';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${NEST_BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
