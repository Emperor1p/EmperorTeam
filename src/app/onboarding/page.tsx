'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AuthFrame, PENDING_SPONSOR, SponsorPicker, StatusFields, checkStatusNumbers, type SponsorHit } from '@/components/auth';
import { PasswordInput } from '@/components/ui';

// For people who joined through Google or an emailed invite and still need a sponsor and status.
export default function Onboarding() {
  const router = useRouter();
  const sb = supabase();
  const [ready, setReady] = useState(false);
  const [needPw, setNeedPw] = useState(false);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [sponsor, setSponsor] = useState<SponsorHit | null>(null);
  const [kind, setKind] = useState('0');
  const [qpv, setQpv] = useState('');
  const [earn, setEarn] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: p } = await sb.from('profiles').select('name,onboarded').eq('id', user.id).maybeSingle();
      if (p?.onboarded) { router.replace('/dashboard'); return; }
      setName(p?.name && p.name.includes(' ') ? p.name : '');
      setNeedPw((user.app_metadata?.provider || 'email') === 'email');
      let sid: string | null = null;
      try { sid = localStorage.getItem(PENDING_SPONSOR); } catch { /* ignore */ }
      if (sid) { const { data: s } = await sb.rpc('sponsor_card', { p_id: sid }); if (s && s[0]) setSponsor(s[0]); }
      setReady(true);
    })();
  }, [sb, router]);

  const save = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (name.trim().split(/\s+/).length < 2) return setErr('Enter your first and last name.');
    if (!sponsor) return setErr('Choose your sponsor.');
    if (needPw && pw.length < 6) return setErr('Choose a password of at least 6 characters.');
    const bad = checkStatusNumbers(qpv, earn); if (bad) return setErr(bad);
    setBusy(true);
    if (needPw) {
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) { setBusy(false); return setErr(error.message); }
    }
    const { error } = await sb.rpc('complete_signup', { p_name: name.trim(), p_sponsor: sponsor.id, p_rank: Number(kind), p_qpv: Number(qpv || 0), p_earn: Number(earn || 0) });
    setBusy(false);
    if (error) return setErr(error.message);
    try { localStorage.removeItem(PENDING_SPONSOR); } catch { /* ignore */ }
    router.replace('/dashboard');
  };

  if (!ready) return null;
  return (
    <AuthFrame>
      <div className="flex flex-col gap-1"><span style={{ fontWeight: 700, fontSize: 18 }}>Finish setting up your account</span><span className="muted" style={{ fontSize: 13 }}>Tell us who brought you in so you join the right team.</span></div>
      <form onSubmit={save} className="flex flex-col gap-3">
        <label className="field">Full name<input className="input" style={{ height: 40 }} value={name} onChange={e => setName(e.target.value)} placeholder="Grace Johnson" /></label>
        {needPw && <label className="field">Choose a password<PasswordInput style={{ height: 40 }} autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 6 characters" /></label>}
        <SponsorPicker value={sponsor} onChange={setSponsor} hasRoot={true} />
        <StatusFields {...{ kind, setKind, qpv, setQpv, earn, setEarn }} />
        {err && <span role="alert" className="err">{err}</span>}
        <button type="submit" className="btn btn-p btn-lg" disabled={busy}>Join my team</button>
        <button type="button" className="btn btn-s" onClick={async () => { await sb.auth.signOut(); router.replace('/login'); }}>Sign out</button>
      </form>
    </AuthFrame>
  );
}
