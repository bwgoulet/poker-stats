'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart3, CircleDollarSign, Gamepad2, Users } from 'lucide-react';

const nav = [
  ['/dashboard', 'Dashboard', BarChart3],
  ['/games', 'Games', Gamepad2],
  ['/players', 'Players', Users],
  ['/stats', 'Stats', CircleDollarSign],
] as const;

export function NavigationLinks() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const query = searchParams.toString();

  return (
    <nav className="mt-8 grid gap-2">
      {nav.map(([href, label, Icon]) => (
        <Link
          className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold ${pathname.startsWith(href) ? 'border-white/15 bg-white/12 text-white shadow-sm' : 'border-transparent text-blue-100/75 hover:bg-white/8 hover:text-white focus:bg-white/8'}`}
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
