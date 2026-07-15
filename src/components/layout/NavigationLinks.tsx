'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BarChart3, CircleDollarSign, Gamepad2, Users } from 'lucide-react';

const nav = [
  ['/dashboard', 'Dashboard', BarChart3],
  ['/games', 'Games', Gamepad2],
  ['/players', 'Players', Users],
  ['/stats', 'Stats', CircleDollarSign],
] as const;

export function NavigationLinks() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <nav className="mt-8 grid gap-2">
      {nav.map(([href, label, Icon]) => (
        <Link
          className="flex gap-3 items-center rounded-xl px-3 py-2 hover:bg-red-50 focus:bg-red-50"
          key={href}
          href={query ? `${href}?${query}` : href}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
