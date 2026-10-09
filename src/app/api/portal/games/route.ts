import { NextRequest, NextResponse } from 'next/server';
import { handle, mutationClient, parseBody, rpcError } from '@/lib/backend/http';
import { saveGameSchema } from '@/lib/backend/validation';
export async function POST(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request);
    const { leagueId, game } = await parseBody(request, saveGameSchema);
    const { data, error } = await client.rpc('save_game', { p_league_id: leagueId, p_game: game });
    rpcError(error);
    return NextResponse.json(data, { status: game.id ? 200 : 201 });
  });
}
