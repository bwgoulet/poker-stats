import { NextRequest, NextResponse } from 'next/server';
import { handle, mutationClient, parseBody, rpcError } from '@/lib/backend/http';
import { deleteGameSchema } from '@/lib/backend/validation';
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const client = await mutationClient(request);
    const { leagueId, expectedVersion } = await parseBody(request, deleteGameSchema);
    const { id } = await context.params;
    const { error } = await client.rpc('delete_game', { p_league_id: leagueId, p_game_id: id, p_expected_version: expectedVersion });
    rpcError(error);
    return NextResponse.json({ deleted: true });
  });
}
