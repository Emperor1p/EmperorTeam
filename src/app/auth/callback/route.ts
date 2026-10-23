import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { serverSupabase } from '@/lib/supabase/server';

// Handles links from Supabase emails and Google sign-in.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = url.searchParams.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  const sb = await serverSupabase();
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  let error: { message: string } | null = null;
  if (code) ({ error } = await sb.auth.exchangeCodeForSession(code));
  else if (tokenHash && type) ({ error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type }));
  else error = { message: url.searchParams.get('error_description') || 'That link is invalid or has expired.' };
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('That link is invalid or has expired. Please sign in or request a new one.')}`, url.origin));
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
