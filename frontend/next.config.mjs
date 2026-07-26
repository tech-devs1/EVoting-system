import withPWAInit from '@ducanh2912/next-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withPWA = withPWAInit({
  dest: 'public',
  disable: false, // Enable in development so you can test the install button
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Vercel (Next.js 16 uses Turbopack by default).
  // Silences the "webpack config but no turbopack config" build error.
  turbopack: {},
  // outputFileTracingRoot silences the "multiple lockfiles" warning locally
  outputFileTracingRoot: path.join(__dirname, '../'),
};

export default withPWA(nextConfig);
