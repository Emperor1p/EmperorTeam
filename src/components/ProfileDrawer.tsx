'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReady } from './Store';
import { useUI } from './Shell';
import { Avatar, RankBadge } from './ui';
import { RANKS, addDays, clock, daysBetween, dmId, fd, fdw, lagosDateOf, monthShort, usd } from '@/lib/logic';

export function monthLine(p: { teamQ: number; mr: number; status_rank: number }) {
  return p.mr < p.status_rank ? `${p.teamQ} QPV · This month: ${RANKS[p.mr]}` : `${p.teamQ} QPV this month`;
}

export function ProfileDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useReady();
  const ui = useUI();
  const router = useRouter();
  const p = s.I[id];
  const [statusVal, setStatusVal] = useState(String(p?.status_rank ?? 0));
  useEffect(() => { if (p) setStatusVal(String(p.status_rank)); }, [p?.status_rank]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  if (!p) return null;

  const { data, today, uid } = s;
  const canManage = s.T.desc(uid).includes(id);
  const log = data.logs.find(l => l.member_id === id && l.log_date === today);
  const todos = data.todos.filter(t => t.member_id === id && t.todo_date === today);
  const orders = data.orders.filter(o => o.member_id === id && o.order_date >= s.m0);
  const book = data.books.find(b => b.member_id === id)?.title;
  const idle = daysBetween(lagosDateOf(p.last_active_at), today);
  const mon = monthShort(today);
  const stats = [
    ['Own QPV · ' + mon, p.q], ['Total QPV (with team)', p.teamQ], ['Team size', p.team.length], ['Personal · ' + mon, usd(p.personal)],
    ['Team earnings · ' + mon, usd(p.teamEarn)], ['Orders · ' + mon, p.ordN], ['Direct legs', (s.T.kids[id] || []).length]
  ] as const;
  const facts = [
    ['Sponsor', p.sponsorName], ['Joined', fd(lagosDateOf(p.joined_at)) + ' ' + p.joined_at.slice(0, 4)],
    ['Activity', `${p.activity} · last active ${idle ? idle + ' days ago' : 'today'}`],
    ['Today', log ? `${log.fiverr_msgs} Fiverr · ${log.upwork_msgs} Upwork msgs · ${log.orders} orders · ${log.cancellations} cancelled` : 'No check-in yet'],
    ['Book this month', book || '—'], ['Email', p.email]
  ];

  const saveStatus = async () => {
    const r = Number(statusVal);
    if (r === p.status_rank) return s.say('No change.');
    await s.run(s.sb.rpc('correct_status', { member: id, new_rank: r }), `${p.first}’s status set to ${RANKS[r]}`, 'profiles', 'achievements', 'notifs');
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 50 }} />
      <aside role="dialog" aria-label={`${p.name} profile`} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px,100vw)', background: 'var(--panel)', zIndex: 55, overflowY: 'auto', boxShadow: '-10px 0 40px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--line)', display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar p={p} size={52} font={17} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 18 }}>{p.name}</span>
            <div className="flex flex-wrap items-center gap-1.5"><RankBadge rank={p.status_rank} small /><span style={{ fontSize: 12.5, color: 'var(--mut)' }}>{monthLine(p)}</span></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--panel)', color: 'var(--ink)', cursor: 'pointer', fontWeight: 700 }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="grid grid-cols-2 gap-2.5">
            {stats.map(([k, v]) => <div key={k} className="stat"><span className="stat-label">{k}</span><span className="tnum" style={{ fontSize: 17, fontWeight: 700 }}>{v}</span></div>)}
          </div>
          <div className="flex flex-col">
            {facts.map(([k, v]) => <div key={k} className="flex justify-between gap-3" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13 }}><span className="muted">{k}</span><span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span></div>)}
          </div>
          {id !== uid && <button type="button" className="btn btn-p" style={{ height: 40, borderRadius: 10 }} onClick={() => ui.openConv(dmId(uid, id))}>Message {p.first}</button>}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2"><span style={{ fontWeight: 600 }}>Today&apos;s to-do list</span><span style={{ fontSize: 12.5 }} className="muted">{todos.length ? `${todos.filter(t => t.done).length} of ${todos.length} done` : 'No list yet'}</span></div>
            {todos.map(t => (
              <div key={t.id} className="flex gap-2" style={{ padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 13 }}>
                <span style={{ width: 16, color: t.done ? 'var(--ok)' : 'var(--mut)', fontWeight: 700 }}>{t.done ? '✓' : '○'}</span>
                <span style={{ textDecoration: t.done ? 'line-through' : 'none', flex: 1 }}>{t.body}</span>
                {t.done && t.done_at && <span className="muted" style={{ fontSize: 11.5 }}>{clock(t.done_at)}</span>}
              </div>
            ))}
            {!todos.length && <span style={{ fontSize: 13, color: 'var(--bad)' }}>No to-do list yet today.</span>}
          </div>
          {canManage && <>
            <div className="flex flex-col gap-2" style={{ background: 'var(--sunk)', borderRadius: 12, padding: 14 }}>
              <span style={{ fontWeight: 600 }}>Correct status</span>
              <span style={{ fontSize: 12.5 }} className="muted">Use this if their status on the website was different. Raising it counts as a step-up and notifies their upline.</span>
              <div className="flex flex-wrap gap-2">
                <select className="input" style={{ flex: 1, minWidth: 160, height: 36 }} value={statusVal} onChange={e => setStatusVal(e.target.value)} aria-label="Status">{RANKS.map((r, i) => <option key={r} value={i}>{r}</option>)}</select>
                <button type="button" className="btn btn-p" onClick={saveStatus}>Save status</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-s btn-md" onClick={() => { onClose(); ui.openModal({ kind: 'task', to: id }); }}>Assign task</button>
              <button type="button" className="btn btn-s btn-md" onClick={() => { onClose(); ui.openModal({ kind: 'ach', who: id }); }}>Add achievement</button>
              <button type="button" className="btn btn-s btn-md" onClick={() => { onClose(); router.push(`/team?focus=${id}`); }}>View their team</button>
            </div>
          </>}
          <div className="flex flex-col gap-1.5">
            <span style={{ fontWeight: 600 }}>Orders · {new Date(today + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })}</span>
            {orders.map(o => (
              <div key={o.id} className="flex justify-between gap-2.5" style={{ padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 13 }}>
                <div className="flex min-w-0 flex-col"><span style={{ fontWeight: 600, textDecoration: o.status === 'Cancelled' ? 'line-through' : 'none' }}>{o.project}</span><span style={{ fontSize: 12 }} className="muted">{o.platform} · {fd(o.order_date)} · {o.status}</span></div>
                <span className="tnum" style={{ fontWeight: 700, textDecoration: o.status === 'Cancelled' ? 'line-through' : 'none' }}>{usd(o.amount)}</span>
              </div>
            ))}
            {!orders.length && <span style={{ fontSize: 13 }} className="muted">No orders this month.</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <span style={{ fontWeight: 600 }}>Last 7 days</span>
            {Array.from({ length: 7 }, (_, k) => addDays(today, -k)).map(d => {
              const x = data.logs.find(l => l.member_id === id && l.log_date === d);
              return (
                <div key={d} className="flex justify-between gap-2.5" style={{ fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                  <span style={{ width: 70 }} className="muted">{fdw(d).replace(/ \w+$/, '')}</span>
                  <span style={{ flex: 1, color: x ? 'var(--ink)' : 'var(--bad)' }}>{x ? `${x.fiverr_msgs + x.upwork_msgs} messages · ${x.orders} orders · ${x.cancellations} cancelled` : 'Missed check-in'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
