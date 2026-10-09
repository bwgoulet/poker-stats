import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/backend/supabase';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const client = await serverSupabase();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/manage', request.url));
  }
  return NextResponse.redirect(new URL('/auth/login', request.url));
}
