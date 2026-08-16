'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // When a newly-activated service worker takes control (i.e. a fresh build
    // was deployed), reload the page once so the user is guaranteed to be
    // running the latest code. iOS Safari can otherwise keep serving the old
    // cached app shell for days.
    let refreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Force an update check on every load — browsers may otherwise wait a
        // long time before noticing a new sw.js on their own.
        registration.update().catch(() => {});
      })
      .catch((error) => {
        console.error('[SW] Service Worker registration failed:', error);
      });
  }, []);

  return null;
}
