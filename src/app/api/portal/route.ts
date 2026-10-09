import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPortalData } from '@/lib/backend/repository';
import { handle, HttpError } from '@/lib/backend/http';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return handle(async () => {
    const requested = request.nextUrl.searchParams.get('leagueId');
    const leagueId = requested ? z.uuid().parse(requested) : undefined;
    const data = await getPortalData(leagueId);
    if (leagueId && data.selectedLeagueId !== leagueId) throw new HttpError(403, 'You no longer have access to that league.');
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  });
}
