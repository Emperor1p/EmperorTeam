'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AuthFrame } from '@/components/auth';
import { PasswordField } from '@/components/ui';

export default function ResetPassword() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return setErr('Password must be at least 6 characters.');
    const { error } = await supabase().auth.updateUser({ password: pw });
    if (error) return setErr('Your reset link has expired. Request a new one from the sign-in page.');
    router.replace('/dashboard');
  };
  return (
    <AuthFrame>
      <form onSubmit={save} className="flex flex-col gap-3">
        <span className="card-title">Choose a new password</span>
        <PasswordField label="New password" style={{ height: 40 }} autoComplete="new-password" value={pw} onChange={e => { setPw(e.target.value); setErr(''); }} />
        {err && <span role="alert" className="err">{err}</span>}
        <button type="submit" className="btn btn-p btn-lg">Save password</button>
      </form>
    </AuthFrame>
  );
}
