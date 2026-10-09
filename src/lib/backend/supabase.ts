import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Set both the Supabase URL and publishable key.');
  return { url, key };
}

export async function serverSupabase() {
  const config = supabaseConfig();
  if (!config) throw new Error('Supabase is not configured.');
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => {
        // Server Components cannot write cookies. The request proxy refreshes them.
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Cookie writes remain available in route handlers. */ }
      },
    },
  });
}
