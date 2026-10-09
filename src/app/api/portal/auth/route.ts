import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, HttpError, mutationClient, parseBody } from '@/lib/backend/http';
const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(512) }).strict();
export async function POST(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request, false);
    const credentials = await parseBody(request, loginSchema);
    const { error } = await client.auth.signInWithPassword(credentials);
    if (error) throw new HttpError(401, 'Sign-in failed. Check your email and password.');
    return NextResponse.json({ signedIn: true });
  });
}
export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request, false);
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw new HttpError(500, 'Unable to sign out. Try again.');
    return NextResponse.json({ signedOut: true });
  });
}
