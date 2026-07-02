import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: false, // Enable in development so you can test the install button
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
