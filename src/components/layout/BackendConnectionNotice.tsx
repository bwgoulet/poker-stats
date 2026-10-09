'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function BackendConnectionNotice() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">
    <p>League records are unavailable. Retry or check the database connection.</p>
    <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="rounded-lg border border-amber-300 bg-white px-4 py-2 font-bold disabled:opacity-60">{pending ? 'Retrying…' : 'Retry'}</button>
  </div>;
}
