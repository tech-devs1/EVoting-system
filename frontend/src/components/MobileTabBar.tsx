'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export interface MobileTab {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Native-app style bottom tab bar, shown only on small screens (below md).
 * Desktop keeps the existing sidebar layout untouched. Solid background
 * (no backdrop-filter — iOS Safari hit-testing bug), with safe-area padding
 * so the home-screen PWA bar never overlaps the tabs.
 */
export default function MobileTabBar({ tabs }: { tabs: MobileTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-stretch h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + '/');

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center justify-center gap-1 flex-1 text-[10px] font-bold tracking-wide transition-colors touch-manipulation ${
                isActive
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 active:text-slate-700 dark:active:text-slate-200'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-700 dark:bg-blue-400" />
              )}
              <Icon
                size={21}
                strokeWidth={isActive ? 2.4 : 2}
                className={isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
