import withPWAInit from '@ducanh2912/next-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withPWA = withPWAInit({
  dest: 'public',
  disable: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Vercel (Next.js 16 uses Turbopack by default)
  turbopack: {},
  // outputFileTracingRoot silences the "multiple lockfiles" warning locally
  outputFileTracingRoot: path.join(__dirname, '../'),
  async rewrites() {
    // On Vercel, root vercel.json routes /api/* → backend/server.js directly,
    // so these rewrites are only used in local development.
    // In local dev, BACKEND_URL defaults to http://localhost:5000
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default withPWA(nextConfig);
