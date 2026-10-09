'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export function PortalDialog({ title, children, onClose, busy = false }: {
  title: string; children: React.ReactNode; onClose: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    element?.querySelector<HTMLElement>('[data-dialog-focus]')?.focus();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}
    className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border bg-white p-0 text-ink shadow-2xl backdrop:bg-navy/45 backdrop:backdrop-blur-sm">
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id={titleId} className="text-xl font-bold text-navy">{title}</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog" className="rounded-lg p-2 hover:bg-carolina-light focus-visible:outline-2 disabled:opacity-40"><X size={18} /></button>
      </div>
      {children}
    </div>
  </dialog>;
}
