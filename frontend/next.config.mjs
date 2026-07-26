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
  // outputFileTracingRoot silences the "multiple lockfiles" warning
  outputFileTracingRoot: path.join(__dirname, '../'),
};

export default withPWA(nextConfig);
