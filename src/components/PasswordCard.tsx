'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useReady } from './Store';

/** Settings card: change password (checks the current one), set one if you joined with Google, or email a reset link. */
export function PasswordCard() {
  const s = useReady();
  const [hasPassword, setHasPassword] = useState(true);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    s.sb.auth.getUser().then(({ data }: { data: { user: { app_metadata?: { providers?: string[]; provider?: string } } | null } }) => {
      const md = data.user?.app_metadata;
      const providers = md?.providers || (md?.provider ? [md.provider] : []);
      setHasPassword(providers.length === 0 || providers.includes('email'));
    });
  }, [s.sb]);

  const save = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (hasPassword && !current) return setErr('Enter your current password.');
    if (next.length < 6) return setErr('New password must be at least 6 characters.');
    if (next !== again) return setErr('The new passwords don’t match.');
    if (hasPassword && next === current) return setErr('Choose a password different from your current one.');
    setBusy(true);
    if (hasPassword) {
      // Confirm it's really you before changing the password.
      const { error } = await s.sb.auth.signInWithPassword({ email: s.me.email, password: current });
      if (error) { setBusy(false); return setErr('Your current password is incorrect.'); }
    }
    const { error } = await s.sb.auth.updateUser({ password: next });
    setBusy(false);
    if (error) {
      if (/reauth|recent/i.test(error.message)) return setErr('For your security, use “Email me a reset link” below to change your password.');
      if (/weak|pwned|leaked/i.test(error.message)) return setErr('That password is too easy to guess. Try a longer one.');
      return setErr(error.message);
    }
    setCurrent(''); setNext(''); setAgain(''); setHasPassword(true);
    s.say(hasPassword ? 'Password changed' : 'Password set · you can now sign in with your email too');
  };

  const sendReset = async () => {
    setBusy(true);
    const { error } = await s.sb.auth.resetPasswordForEmail(s.me.email, { redirectTo: `${location.origin}/auth/callback?next=/auth/reset` });
    setBusy(false);
    if (error) return s.say(/rate|seconds/i.test(error.message) ? 'Please wait a minute before asking for another link.' : 'Couldn’t send the email. Try again shortly.');
    s.say(`Reset link sent to ${s.me.email}`);
  };

  const on = (f: (v: string) => void) => (e: { target: { value: string } }) => { f(e.target.value); setErr(''); };
  return (
    <div className="card flex flex-col gap-3" style={{ padding: 20 }}>
      <span className="card-title">{hasPassword ? 'Change password' : 'Set a password'}</span>
      {!hasPassword && <span className="muted" style={{ fontSize: 13 }}>You joined with Google. Set a password if you also want to sign in with your email.</span>}
      <form onSubmit={save} className="flex flex-col gap-2.5">
        <input type="email" autoComplete="username" value={s.me.email} readOnly hidden />
        {hasPassword && <label className="field">Current password<input className="input" type="password" autoComplete="current-password" value={current} onChange={on(setCurrent)} /></label>}
        <label className="field">New password<input className="input" type="password" autoComplete="new-password" value={next} onChange={on(setNext)} placeholder="At least 6 characters" /></label>
        <label className="field">Confirm new password<input className="input" type="password" autoComplete="new-password" value={again} onChange={on(setAgain)} /></label>
        {err && <span role="alert" className="err">{err}</span>}
        <button type="submit" className="btn btn-p" style={{ alignSelf: 'flex-start' }} disabled={busy}>{hasPassword ? 'Change password' : 'Set password'}</button>
      </form>
      <div className="flex flex-col gap-1.5" style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>Forgot your password?</span>
        <span className="muted" style={{ fontSize: 13 }}>We’ll email a link to {s.me.email} so you can choose a new one.</span>
        <button type="button" className="btn btn-s btn-md" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={sendReset}>Email me a reset link</button>
      </div>
    </div>
  );
}
