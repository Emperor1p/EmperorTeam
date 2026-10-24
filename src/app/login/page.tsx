'use client';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AuthFrame, PENDING_SPONSOR, SponsorPicker, StatusFields, checkStatusNumbers, consumeHashSession, type SponsorHit } from '@/components/auth';

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const sb = supabase();
  const [tab, setTab] = useState<'in' | 'up' | 'reset'>(params.get('sponsor') ? 'up' : 'in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [sponsor, setSponsor] = useState<SponsorHit | null>(null);
  const [hasRoot, setHasRoot] = useState<boolean | null>(null);
  const [kind, setKind] = useState('0');
  const [qpv, setQpv] = useState('');
  const [earn, setEarn] = useState('');
  const [err, setErr] = useState(params.get('error') || '');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (await consumeHashSession()) { router.replace('/dashboard'); return; }
      const { data: { user } } = await sb.auth.getUser();
      if (user) { router.replace('/dashboard'); return; }
      const { data } = await sb.rpc('org_has_root');
      setHasRoot(data === true);
      const sid = params.get('sponsor');
      if (sid) {
        try { localStorage.setItem(PENDING_SPONSOR, sid); } catch { /* private mode */ }
        const { data: s } = await sb.rpc('sponsor_card', { p_id: sid });
        if (s && s[0]) setSponsor(s[0]);
      }
    })();
  }, [sb, router, params]);

  const pick = (t: typeof tab) => () => { setTab(t); setErr(''); setInfo(''); };

  const signIn = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setErr(error.message === 'Email not confirmed' ? 'Confirm your email first. Check your inbox for the link.' : 'Email or password is incorrect.');
    router.replace('/dashboard');
  };

  const signUp = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    const n = name.trim();
    if (n.split(/\s+/).length < 2) return setErr('Enter your first and last name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr('Enter a valid email.');
    if (password.length < 6) return setErr('Password must be at least 6 characters.');
    if (hasRoot && !sponsor) return setErr('Choose your sponsor. Only the first person (the top leader) has no sponsor.');
    const bad = checkStatusNumbers(qpv, earn); if (bad) return setErr(bad);
    setBusy(true);
    const { data, error } = await sb.auth.signUp({
      email: email.trim(), password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: { name: n, sponsor_id: hasRoot ? sponsor?.id : '', status_rank: String(kind), qpv: qpv || '0', earn: earn || '0' }
      }
    });
    setBusy(false);
    if (error) return setErr(/registered|exists/i.test(error.message) ? 'An account with this email already exists.' : error.message);
    try { localStorage.removeItem(PENDING_SPONSOR); } catch { /* ignore */ }
    if (data.session) router.replace('/dashboard');
    else setInfo(`Almost done. We sent a confirmation link to ${email.trim()}. Open it on this device to finish.`);
  };

  const google = async () => {
    setErr('');
    if (sponsor) try { localStorage.setItem(PENDING_SPONSOR, sponsor.id); } catch { /* ignore */ }
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } });
    if (error) setErr('Google sign-in isn’t available right now. Use email instead.');
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr('Enter a valid email.');
    setBusy(true);
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth/callback?next=/auth/reset` });
    setBusy(false);
    if (error) return setErr(error.message);
    setInfo('If that email has an account, a reset link is on its way.');
  };

  const tabs: [typeof tab, string][] = [['in', 'Sign in'], ['up', 'Sign up']];
  return (
    <AuthFrame>
      <div role="tablist" className="flex gap-0.5" style={{ background: 'var(--sunk)', borderRadius: 10, padding: 3 }}>
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={pick(id)}
            style={{ flex: 1, height: 34, border: 'none', borderRadius: 8, background: tab === id ? 'var(--panel)' : 'transparent', color: tab === id ? 'var(--ink)' : 'var(--mut)', fontWeight: 600, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>

      {info ? (
        <div className="flex flex-col gap-3"><span style={{ fontWeight: 600 }}>{info}</span><button type="button" className="btn btn-s" onClick={pick('in')}>Back to sign in</button></div>
      ) : tab === 'in' ? (
        <form onSubmit={signIn} className="flex flex-col gap-3">
          <label className="field">Email<input className="input" style={{ height: 40 }} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" /></label>
          <label className="field">Password<input className="input" style={{ height: 40 }} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" /></label>
          {err && <span role="alert" className="err">{err}</span>}
          <button type="submit" className="btn btn-p btn-lg" disabled={busy}>Sign in</button>
          <button type="button" className="btn btn-s btn-lg" style={{ fontSize: 14 }} onClick={google}>Continue with Google</button>
          <button type="button" className="link" onClick={pick('reset')} style={{ fontSize: 13, fontWeight: 600, alignSelf: 'center' }}>Forgot password?</button>
        </form>
      ) : tab === 'reset' ? (
        <form onSubmit={reset} className="flex flex-col gap-3">
          <span className="muted">Enter your email and we’ll send a link to choose a new password.</span>
          <label className="field">Email<input className="input" style={{ height: 40 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" /></label>
          {err && <span role="alert" className="err">{err}</span>}
          <button type="submit" className="btn btn-p btn-lg" disabled={busy}>Send reset link</button>
        </form>
      ) : (
        <form onSubmit={signUp} className="flex flex-col gap-3">
          <label className="field">Full name<input className="input" style={{ height: 40 }} autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Grace Johnson" /></label>
          <label className="field">Email (Gmail for meeting invites)<input className="input" style={{ height: 40 }} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="grace@gmail.com" /></label>
          <label className="field">Password<input className="input" style={{ height: 40 }} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>
          <SponsorPicker value={sponsor} onChange={setSponsor} hasRoot={hasRoot} />
          <StatusFields {...{ kind, setKind, qpv, setQpv, earn, setEarn }} />
          {err && <span role="alert" className="err">{err}</span>}
          <button type="submit" className="btn btn-p btn-lg" disabled={busy}>Create account</button>
          <button type="button" className="btn btn-s btn-lg" style={{ fontSize: 14 }} onClick={google}>Sign up with Google</button>
        </form>
      )}
    </AuthFrame>
  );
}
