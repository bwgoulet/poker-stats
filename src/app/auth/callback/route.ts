import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/backend/supabase';
import { accountReturnTo } from '@/lib/backend/account';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const next = accountReturnTo(request.nextUrl.searchParams.get('next'));
  if (code || (tokenHash && (type === 'email' || type === 'signup'))) {
    const client = await serverSupabase();
    const { error } = code ? await client.auth.exchangeCodeForSession(code)
      : await client.auth.verifyOtp({ token_hash: tokenHash!, type: type as 'email' | 'signup' });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  const failure = new URL('/auth/login', request.url);
  failure.searchParams.set('confirmation', 'failed');
  failure.searchParams.set('next', next);
  return NextResponse.redirect(failure);
}
