'use client';

/**
 * Hard-navigate to a path with a full page load.
 *
 * Client-side `router.push` is unreliable on iOS Safari for statically-exported
 * (cPanel) deployments: the URL can change while the new page never renders
 * (Next.js client navigation fetches RSC payloads that aren't served), and the
 * PWA service worker can restore a stale cached page. A full page load through
 * the SPA fallback (see public/.htaccess) always lands on the correct page.
 */
export function hardNavigate(targetPath: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.location.pathname === targetPath) return;
    window.location.assign(targetPath);
  } catch (err) {
    console.warn('[Navigation] window.location.assign failed, falling back to href:', err);
    window.location.href = targetPath;
  }
}
