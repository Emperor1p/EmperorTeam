'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { consumeHashSession } from '@/components/auth';

// Supabase's Site URL lands here. Pass code links to the callback and invite tokens into a session.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code');
    if (code) { router.replace(`/auth/callback?code=${encodeURIComponent(code)}`); return; }
    consumeHashSession().finally(() => router.replace('/dashboard'));
  }, [router]);
  return null;
}
