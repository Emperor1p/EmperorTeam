'use client';
import { useReady } from '@/components/Store';
import { useUI } from '@/components/Shell';
import { PageHead } from '@/components/ui';
import { clock, lagosDateOf, monthShort } from '@/lib/logic';
import type { Meeting } from '@/lib/types';

export default function Meetings() {
  const s = useReady();
  const ui = useUI();
  const { uid, T, today, nameOf, data } = s;
  const hasTeam = T.desc(uid).length > 0;
  const list = data.meetings.filter(m => lagosDateOf(m.starts_at) >= today);
  const first = (id: string | null) => (id && nameOf[id] ? nameOf[id].split(' ')[0] : '');
  const aud = (m: Meeting) => m.audience === 'direct' ? 'Direct legs' : m.audience === 'team' ? `${first(m.team_of)}’s team` : !T.M[m.host_id]?.sponsor_id ? 'Entire team' : `${first(m.host_id)}’s whole team`;
  return (
    <>
      <PageHead title="Meetings & Training" sub="Invites go to each person's email and their notifications."
        action={hasTeam ? <button type="button" className="btn btn-p" onClick={() => ui.openModal({ kind: 'meeting' })}>Schedule meeting</button> : undefined} />
      <div className="card overflow-hidden">
        {list.map(m => {
          const d = lagosDateOf(m.starts_at);
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3.5" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
              <div className="flex flex-none flex-col items-center" style={{ width: 54, background: 'var(--sunk)', borderRadius: 10, padding: '6px 0' }}>
                <span className="muted" style={{ fontSize: 11, fontWeight: 700 }}>{monthShort(d).toUpperCase()}</span><span style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.1 }}>{Number(d.slice(8))}</span>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5" style={{ flex: '1 1 220px' }}>
                <span style={{ fontWeight: 600 }}>{m.title}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{clock(m.starts_at)} · Host {m.host_id === uid ? 'you' : nameOf[m.host_id] || '—'} · {aud(m)} · {m.invitee_count} invited</span>
              </div>
              <a href={m.meet_link} target="_blank" rel="noopener noreferrer" className="btn btn-p btn-md">Join Google Meet</a>
            </div>
          );
        })}
        {!list.length && <div className="empty">No upcoming meetings.</div>}
      </div>
    </>
  );
}
