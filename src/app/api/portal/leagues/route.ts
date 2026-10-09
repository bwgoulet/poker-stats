import { NextRequest, NextResponse } from 'next/server';
import { handle, mutationClient, parseBody, rpcError } from '@/lib/backend/http';
import { createLeagueSchema } from '@/lib/backend/validation';
export async function POST(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request);
    const { name, slug, visibility } = await parseBody(request, createLeagueSchema);
    const { data, error } = await client.rpc('create_league', { p_name: name, p_slug: slug, p_visibility: visibility });
    rpcError(error);
    return NextResponse.json({ id: data }, { status: 201 });
  });
}
