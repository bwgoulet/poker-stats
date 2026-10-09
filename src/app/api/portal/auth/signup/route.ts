import { NextRequest, NextResponse } from 'next/server';
import { accountReturnTo } from '@/lib/backend/account';
import { handle, HttpError, mutationClient, parseBody } from '@/lib/backend/http';
import { signupSchema } from '@/lib/backend/validation';

export async function POST(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request, false);
    const { email, password, displayName, next } = await parseBody(request, signupSchema);
    const callback = new URL('/auth/callback', request.nextUrl.origin);
    callback.searchParams.set('next', accountReturnTo(next));
    const { data, error } = await client.auth.signUp({ email, password, options: {
      data: { display_name: displayName }, emailRedirectTo: callback.toString(),
    } });
    if (error?.status === 429) throw new HttpError(429, 'Too many signup attempts. Please wait a few minutes and try again.');
    if (error) throw new HttpError(400, 'Unable to create the account. Check your details, or sign in if you already have an account.');
    return NextResponse.json({ signedIn: !!data.session });
  });
}
