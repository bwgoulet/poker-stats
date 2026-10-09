import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, mutationClient, parseBody, rpcError, HttpError } from '@/lib/backend/http';
export async function POST(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request);
    const { requestId, approve } = await parseBody(request, z.object({ requestId: z.uuid(), approve: z.boolean() }).strict());
    const { error } = await client.rpc('review_player_link_v2', { p_request_id: requestId, p_approve: approve });
    if (error?.code === 'PGRST202' || error?.code === '42883') throw new HttpError(503, 'Player link approval needs a database update. Apply migration 202610090007, then try again.');
    if (error?.code === '42501') throw new HttpError(403, 'Only an app administrator or an owner/admin of this league can review player links.');
    if (error?.code === '40001') throw new HttpError(409, 'This request has already been reviewed. Refresh the page.');
    if (error?.code === '23505') throw new HttpError(409, 'The player or account already has a link in this league. Reject this request or resolve the existing link first.');
    rpcError(error);
    return NextResponse.json({ reviewed: true });
  });
}
export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request);
    const { requestId } = await parseBody(request, z.object({ requestId: z.uuid() }).strict());
    const { error } = await client.rpc('cancel_player_link_request', { p_request_id: requestId });
    if (error?.code === '40001') throw new HttpError(409, 'This request is no longer pending. Refresh the page.');
    rpcError(error);
    return NextResponse.json({ cancelled: true });
  });
}
