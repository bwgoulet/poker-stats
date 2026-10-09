import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverSupabase, supabaseConfig } from './supabase';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requestOrigin(request: NextRequest): string {
  // NextURL normalizes loopback IPs to localhost. The actual Host preserves
  // browser origins and cookie scope; don't trust a client-supplied forwarded host.
  const host = request.headers.get('host');
  if (!host) return request.nextUrl.origin;
  if (/[\\/\s,@?#]/.test(host)) throw new HttpError(400, 'The request host is invalid.');
  try { return new URL(`${request.nextUrl.protocol}//${host}`).origin; }
  catch { throw new HttpError(400, 'The request host is invalid.'); }
}
export async function mutationClient(request: NextRequest, requireAuth = true) {
  if (request.headers.get('origin') !== requestOrigin(request)) throw new HttpError(403, 'This request must come from the poker portal.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Send the request as JSON.');
  if (!supabaseConfig()) throw new HttpError(503, 'Connect Supabase before changing records.');
  const client = await serverSupabase();
  if (requireAuth) {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new HttpError(401, 'Sign in to manage league records.');
  }
  return client;
}
export async function parseBody<T>(request: NextRequest, schema: z.ZodType<T>): Promise<T> {
  const raw = await request.text();
  if (raw.length > 256_000) throw new HttpError(413, 'This request is too large.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new HttpError(400, 'The request contains invalid JSON.'); }
  return schema.parse(value);
}
export function rpcError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === '40001') throw new HttpError(409, 'Someone changed this game. Reload the latest version before saving.');
  if (error.code === '42501') throw new HttpError(403, 'Your league role does not allow this change.');
  if (error.code === '23505') throw new HttpError(409, 'That record already exists. Choose a different name or slug.');
  if (error.code === 'P0002') throw new HttpError(404, 'That record no longer exists. Reload the league.');
  if (['22023', '23514', '23503', '22P02', '22007', '22008', 'P0001'].includes(error.code ?? '')) throw new HttpError(400, error.message);
  throw new HttpError(500, 'The change could not be saved. Please try again.');
}
export async function handle(handler: () => Promise<NextResponse>) {
  try { return await handler(); }
  catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues.map(issue => issue.message).join(' ') }, { status: 400 });
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Unable to access the poker database. Check the connection and try again.' }, { status: 500 });
  }
}
