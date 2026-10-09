import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { accountReturnTo } from '@/lib/backend/account';
import { handle, HttpError, mutationClient, parseBody, requestOrigin } from '@/lib/backend/http';

export async function POST(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request, false);
    const { next } = await parseBody(request, z.object({ next: z.string().max(200).optional() }).strict());
    const callback = new URL('/auth/callback', requestOrigin(request));
    callback.searchParams.set('next', accountReturnTo(next));
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'discord', options: {
      redirectTo: callback.toString(), scopes: 'identify email', skipBrowserRedirect: true,
    } });
    if (error || !data.url) throw new HttpError(503, 'Discord sign-in is unavailable. Ask the site administrator to enable Discord in Supabase Authentication.');
    return NextResponse.json({ url: data.url });
  });
}
