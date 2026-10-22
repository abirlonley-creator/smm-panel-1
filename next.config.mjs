/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      {
        source: '/likes%20analyze',
        destination: '/likes-analyze',
      },
      {
        source: '/likes analyze',
        destination: '/likes-analyze',
      },
    ];
  },
};

export default nextConfig;
