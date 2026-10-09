import { NextRequest, NextResponse } from 'next/server';
import { handle, mutationClient, parseBody, rpcError } from '@/lib/backend/http';
import { createPlayerSchema } from '@/lib/backend/validation';
export async function POST(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request);
    const { leagueId, displayName } = await parseBody(request, createPlayerSchema);
    const { data, error } = await client.rpc('create_player', { p_league_id: leagueId, p_display_name: displayName });
    rpcError(error);
    return NextResponse.json({ id: data }, { status: 201 });
  });
}
