import { Suspense } from 'react';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { NavigationLinks } from '@/components/layout/NavigationLinks';
import { NavigationLoader } from '@/components/layout/NavigationLoader';

export function AppShell({ children, seasonIds }: { children: React.ReactNode; seasonIds: string[] }) {
  return (
    <div className="min-h-screen md:flex">
      <Suspense fallback={null}>
        <NavigationLoader />
      </Suspense>
      <aside className="relative z-20 border-b border-white/10 bg-navy px-4 py-4 text-white shadow-xl md:fixed md:h-screen md:w-72 md:border-b-0 md:border-r md:px-6 md:py-7">
        <div className="flex items-center gap-3 font-black text-xl tracking-tight">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/30 bg-carolina text-2xl text-navy shadow-lg shadow-black/10">♠</div>
          <div><span className="block">UNC Poker</span><span className="block text-[10px] font-bold uppercase tracking-[.22em] text-carolina">League tracker</span></div>
        </div>
        <Suspense fallback={null}>
          <NavigationLinks />
        </Suspense>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-40 bg-gradient-to-t from-carolina/10 to-transparent md:block" />
      </aside>
      <main className="flex-1 md:ml-72">
        <div className="mx-auto max-w-7xl space-y-7 p-4 md:p-8 lg:p-10">
          <Suspense fallback={null}>
            <GlobalFilterBar seasonIds={seasonIds} />
          </Suspense>
          {children}
        </div>
      </main>
    </div>
  );
}
