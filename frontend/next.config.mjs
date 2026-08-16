import withPWAInit from '@ducanh2912/next-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withPWA = withPWAInit({
  dest: 'public',
  disable: false,
  // Activate a newly deployed service worker as soon as possible. iOS Safari is
  // notoriously slow to pick up SW updates; without this a stale service worker
  // can keep serving the old (pre-login) shell for days.
  skipWaiting: true,
  clientsClaim: true,
  // Never precache HTML documents. If the login page HTML is precached, iOS
  // Safari's service worker can serve it for ANY navigation — including the
  // post-login dashboard — making it look like the redirect failed. Pages are
  // handled at runtime with a network-first strategy instead (see below).
  exclude: [/\.html$/, /\.txt$/, /\.map$/],
  runtimeCaching: [
    {
      // Navigation requests (any non-asset URL): always try the network first
      // so the fresh page from cPanel is served; fall back to cache when offline.
      urlPattern: /^\/(?!.*\.(?:js|css|png|jpg|jpeg|svg|gif|ico|webp|woff2?|txt|json|map)$).*$/,
      handler: 'NetworkFirst',
      options: {
        // v2: bumping this changes the generated sw.js bytes, which forces iOS
        // Safari (slow to notice SW updates) to install the new build.
        cacheName: 'pages-v2',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24,
        },
      },
    },
    {
      // Static assets are immutable — cache first is fine and fast.
      urlPattern: /\.(?:js|css|png|jpg|jpeg|svg|gif|ico|webp|woff2?)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'assets-v2',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  turbopack: {},
  outputFileTracingRoot: path.join(__dirname, '../'),
};

export default withPWA(nextConfig);
