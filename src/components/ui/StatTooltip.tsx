'use client';

import { CircleHelp } from 'lucide-react';
import { useId, useState } from 'react';

export function StatTooltip({ label, description }: { label: string; description: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  return <span
    className="group relative inline-flex align-middle"
    onBlur={() => setIsOpen(false)}
    onKeyDown={(event) => event.key === 'Escape' && setIsOpen(false)}
  >
    <button
      type="button"
      className="cursor-help rounded-full text-gray-500 hover:text-navy focus-visible:text-navy focus-visible:outline-2 focus-visible:outline-carolina-dark"
      aria-label={`Explain ${label}`}
      aria-describedby={tooltipId}
      aria-expanded={isOpen}
      onClick={() => setIsOpen((open) => !open)}
    >
      <CircleHelp aria-hidden="true" size={15} strokeWidth={2} />
    </button>
    <span
      id={tooltipId}
      role="tooltip"
      className={`${isOpen ? 'block' : 'hidden'} pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-gray-900 p-3 text-left text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block`}
    >
      {description}
    </span>
  </span>;
}
