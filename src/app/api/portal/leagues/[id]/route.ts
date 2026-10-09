import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, mutationClient, parseBody, rpcError } from '@/lib/backend/http';
import { updateLeagueSchema } from '@/lib/backend/validation';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const client = await mutationClient(request);
    const { id } = await context.params;
    const leagueId = z.uuid().parse(id);
    const { name, visibility } = await parseBody(request, updateLeagueSchema);
    const { error } = await client.rpc('update_league', { p_league_id: leagueId, p_name: name, p_visibility: visibility });
    rpcError(error);
    return NextResponse.json({ updated: true });
  });
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const client = await mutationClient(request);
    const { id } = await context.params;
    const { error } = await client.rpc('delete_league', { p_league_id: z.uuid().parse(id) });
    rpcError(error);
    return NextResponse.json({ deleted: true });
  });
}
