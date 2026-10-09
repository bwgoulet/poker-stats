import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, mutationClient, parseBody, rpcError } from '@/lib/backend/http';
export async function POST(request: NextRequest) {
  return handle(async () => {
    const client = await mutationClient(request);
    const { choice } = await parseBody(request, z.object({ choice: z.enum(['link', 'no_link']) }).strict());
    const { error } = await client.rpc('set_account_onboarding', { p_choice: choice });
    rpcError(error);
    return NextResponse.json({ saved: true });
  });
}
