'use client';
import { useReady } from './Store';

export function InviteLink({ id }: { id: string }) {
  const s = useReady();
  const link = (typeof window !== 'undefined' ? location.origin : '') + `/join/${id}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); s.say('Invite link copied'); } catch { s.say(link); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span style={{ fontSize: 13, background: 'var(--sunk)', borderRadius: 8, padding: '8px 12px', fontWeight: 600, wordBreak: 'break-all' }}>Your invite link: {link}</span>
      <button type="button" className="btn btn-s btn-sm" onClick={copy}>Copy</button>
    </div>
  );
}
