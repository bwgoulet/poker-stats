import { Suspense } from 'react';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { NavigationLinks } from '@/components/layout/NavigationLinks';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="md:fixed md:h-screen md:w-64 bg-white border-r p-5">
        <div className="flex items-center gap-3 font-black text-xl">
          <div className="h-10 w-10 rounded-xl bg-red-600 text-white grid place-items-center">♠</div>
          Poker Tracker
        </div>
        <Suspense fallback={null}>
          <NavigationLinks />
        </Suspense>
      </aside>
      <main className="md:ml-64 flex-1">
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
          <Suspense fallback={null}>
            <GlobalFilterBar />
          </Suspense>
          {children}
        </div>
      </main>
    </div>
  );
}
