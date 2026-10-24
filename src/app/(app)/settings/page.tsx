'use client';
import { useState, type FormEvent } from 'react';
import { useReady } from '@/components/Store';
import { monthLine } from '@/components/ProfileDrawer';
import { InviteLink } from '@/components/InviteLink';
import { PageHead } from '@/components/ui';
import { RANKS, RT, TH } from '@/lib/logic';
import { APP_NAME } from '@/lib/config';

export default function Settings() {
  const s = useReady();
  const { me, uid } = s;
  const [name, setName] = useState(me.name);
  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().split(/\s+/).length < 2) return s.say('Enter your first and last name.');
    await s.run(s.sb.from('profiles').update({ name: name.trim() }).eq('id', uid), 'Name saved', 'profiles', 'names');
  };
  const rows = [['Email', me.email], ['Status', `${me.rLabel}${me.mr < me.status_rank ? ` (this month: ${RANKS[me.mr]})` : ''}`], ['QPV this month', `${me.teamQ} (own ${me.q})`], ['Sponsor', me.sponsorName], ['Month line', monthLine(me)]];
  return (
    <>
      <PageHead title="Settings" sub={`${APP_NAME} · Africa/Lagos · USD`} />
      <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))' }}>
        <div className="card flex flex-col gap-2.5" style={{ padding: 20 }}>
          <span className="card-title">Profile</span>
          <form onSubmit={saveName} className="flex gap-2"><input className="input" style={{ flex: 1, height: 36 }} value={name} onChange={e => setName(e.target.value)} aria-label="Name" /><button type="submit" className="btn btn-s">Save</button></form>
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13.5 }}><span className="muted">{k}</span><span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span></div>)}
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--line)' }}><InviteLink id={uid} /></div>
        </div>
        <div className="card flex flex-col gap-3" style={{ padding: 20 }}>
          <span className="card-title">Install on your phone</span>
          <span className="muted" style={{ fontSize: 13 }}>iPhone: open this site in Safari, tap Share → Add to Home Screen. Android: open in Chrome, tap ⋮ → Install app. It then opens like a normal app.</span>
          <span className="card-title" style={{ paddingTop: 6 }}>Meetings</span>
          <span className="muted" style={{ fontSize: 13 }}>Hosts paste a Google Meet link when scheduling. Everyone invited gets the link by email and in their notifications.</span>
        </div>
        <div className="card flex flex-col gap-2" style={{ padding: 20 }}>
          <span className="card-title">Status ladder (QPV in a month)</span>
          {RANKS.map((r, i) => (
            <div key={r} className="flex items-center justify-between" style={{ padding: '7px 0', borderTop: '1px solid var(--line)' }}>
              <span className="badge" style={{ fontWeight: 700, background: RT[i][0], color: RT[i][1] }}>{r}</span>
              <span className="tnum muted" style={{ fontWeight: 600 }}>{i === 0 ? '0–99 QPV' : i === 5 ? '4,000+ QPV' : i === 6 ? 'Set by sponsor' : `${TH[i].toLocaleString()}–${(TH[i + 1] - 1).toLocaleString()} QPV`}</span>
            </div>
          ))}
          <span className="muted" style={{ fontSize: 12.5, paddingTop: 4 }}>QPV = your own + everyone in your team, and resets to 0 on the 1st (earnings too). Status never goes down. If a Manager&apos;s total is under 500 this month, they stay Manager, and the app also shows &quot;This month: Distributor&quot;. Sponsors can correct a downline&apos;s status.</span>
        </div>
      </div>
    </>
  );
}
