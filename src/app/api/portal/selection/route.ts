import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { handle, HttpError, mutationClient, parseBody, rpcError } from '@/lib/backend/http';
import { selectionSchema } from '@/lib/backend/validation';
import { LEAGUE_COOKIE } from '@/lib/backend/repository';
export async function POST(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request, false);
    const { leagueId } = await parseBody(request, selectionSchema);
    const { data, error } = await client.from('leagues').select('id').eq('id', leagueId).maybeSingle();
    rpcError(error);
    if (!data) throw new HttpError(403, 'You do not have access to that league.');
    (await cookies()).set(LEAGUE_COOKIE, leagueId, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return NextResponse.json({ selectedLeagueId: leagueId });
  });
}
