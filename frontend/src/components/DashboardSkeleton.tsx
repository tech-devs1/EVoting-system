'use client';

import React from 'react';
import Skeleton from './Skeleton';

function HeroBar({ wide }: { wide?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="w-full sm:w-64">
        <Skeleton className="h-6 w-40 md:h-8" />
        <Skeleton className="h-3.5 w-56 mt-2" />
      </div>
      {wide && (
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      )}
    </div>
  );
}

function HeroCard() {
  return (
    <div className="relative overflow-hidden bg-slate-200 dark:bg-slate-800 p-5 md:p-8 rounded-2xl md:rounded-3xl">
      <div className="relative flex items-center gap-4">
        <Skeleton className="w-12 h-12 md:w-14 md:h-14 rounded-2xl shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-5 md:h-7 w-56 md:w-80" />
          <Skeleton className="h-3.5 w-72 md:w-96 mt-2.5" />
        </div>
        <Skeleton className="hidden md:block h-8 w-28 rounded-full shrink-0" />
      </div>
    </div>
  );
}

function KpiStrip({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mobile-scroll-x">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mobile-app-card flex items-center justify-between">
          <div className="flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-14 mt-2" />
          </div>
          <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  );
}

function AnalyticsCards() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-5">
      <div className="lg:col-span-2 mobile-app-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-6 w-44 mt-2" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="flex items-end justify-between gap-3 h-36 border-b border-slate-100 dark:border-slate-800">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="w-8 md:w-10 rounded-lg" style={{ height: `${[40, 65, 50, 90, 75, 80][i]}%` }} />
          ))}
        </div>
      </div>
      <div className="mobile-app-card flex flex-col items-center justify-between gap-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="w-32 h-32 rounded-full" />
        <Skeleton className="h-3.5 w-40" />
      </div>
    </div>
  );
}

function ElectionCardGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mobile-app-card flex flex-col justify-between" style={{ minHeight: '240px' }}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-3.5 w-3/5 mt-3" />
            <Skeleton className="h-3.5 w-2/5 mt-2" />
            <div className="mt-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 p-3">
              <div className="flex justify-between mb-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 w-12 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="mobile-app-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-3/4" />
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full mt-2.5" />
          ))}
        </div>
        <Skeleton className="h-6 w-16 rounded-md shrink-0" />
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Skeleton page that mirrors the structure of each dashboard while its data
 * loads. `role` selects which layout to mirror.
 */
export default function DashboardSkeleton({ role }: { role: 'voter' | 'admin' | 'superadmin' }) {
  return (
    <div className="animate-page-enter flex flex-col gap-5 md:gap-6" aria-busy="true" aria-label="Loading dashboard">
      {role === 'voter' && (
        <>
          <HeroCard />
          <KpiStrip count={3} />
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-14" />
          </div>
          <ListCard />
          <ListCard lines={1} />
        </>
      )}

      {role === 'admin' && (
        <>
          <HeroBar wide />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mobile-scroll-x">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mobile-app-card flex items-start justify-between">
                <div className="flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-14 mt-2" />
                </div>
                <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
              </div>
            ))}
          </div>
          <AnalyticsCards />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-9 w-56 rounded-xl" />
          </div>
          <ElectionCardGrid count={3} />
        </>
      )}

      {role === 'superadmin' && (
        <>
          <HeroBar wide />
          <KpiStrip count={4} />
          <AnalyticsCards />
        </>
      )}
    </div>
  );
}
