'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Loading from '@/app/loading';

export const navigationStartEvent = 'poker:navigation-start';

export function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const startLoading = () => setIsLoading(true);
    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = (event.target as Element).closest('a');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

      const destination = new URL(link.href, window.location.href);
      const changesRoute =
        destination.pathname !== window.location.pathname || destination.search !== window.location.search;
      if (destination.origin === window.location.origin && changesRoute) {
        startLoading();
      }
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', startLoading);
    window.addEventListener(navigationStartEvent, startLoading);
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', startLoading);
      window.removeEventListener(navigationStartEvent, startLoading);
    };
  }, []);

  return isLoading ? <Loading /> : null;
}
