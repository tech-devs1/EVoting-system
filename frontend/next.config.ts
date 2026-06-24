import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // In production (Vercel), BACKEND_URL should be set to the Express backend's URL
    // In local development, it falls back to localhost:5000
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
