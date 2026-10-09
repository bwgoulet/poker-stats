import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { isAnalyticsPath, scopeCookieName, scopeQuery } from '@/lib/filters/scope-query';

export async function proxy(request: NextRequest) {
  const analytics = isAnalyticsPath(request.nextUrl.pathname);
  const cookieName = scopeCookieName(request.cookies.get('poker-active-league')?.value);
  const requestedScope = scopeQuery(request.nextUrl.searchParams).toString();
  const savedScope = scopeQuery(new URLSearchParams(request.cookies.get(cookieName)?.value)).toString();
  if (analytics && !requestedScope && savedScope) {
    const destination = request.nextUrl.clone();
    for (const [key, value] of new URLSearchParams(savedScope)) destination.searchParams.append(key, value);
    return NextResponse.redirect(destination);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (url && key) {
    const client = createServerClient(url, key, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    } });
    await client.auth.getUser();
  }
  // Prefetching a link must never change the user's applied scope.
  const prefetch = request.headers.has('next-router-prefetch') || request.headers.get('purpose') === 'prefetch';
  if (analytics && requestedScope && !prefetch) {
    response.cookies.set(cookieName, requestedScope, {
      path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: true,
      sameSite: 'lax', secure: request.nextUrl.protocol === 'https:',
    });
  }
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
