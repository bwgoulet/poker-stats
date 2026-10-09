import { NextRequest, NextResponse } from 'next/server';
import { handle, HttpError, mutationClient, parseBody, rpcError } from '@/lib/backend/http';
import { playerLinkSchema } from '@/lib/backend/validation';

async function changeLink(request: NextRequest, operation: 'claim_player_page' | 'unlink_player_page') {
  return handle(async () => {
    const client = await mutationClient(request);
    const { leagueId, playerId } = await parseBody(request, playerLinkSchema);
    const { error } = await client.rpc(operation, { p_league_id: leagueId, p_player_id: playerId });
    if (error?.code === '23505') throw new HttpError(409, 'A player page is already linked. Refresh your account to see the current link, or ask a league admin to resolve it.');
    if (error?.code === '42501') throw new HttpError(403, 'Confirm your email, and make sure this is an accessible league and your own player page.');
    rpcError(error);
    return NextResponse.json({ linked: operation === 'claim_player_page' });
  });
}
export const POST = (request: NextRequest) => changeLink(request, 'claim_player_page');
export const DELETE = (request: NextRequest) => changeLink(request, 'unlink_player_page');
