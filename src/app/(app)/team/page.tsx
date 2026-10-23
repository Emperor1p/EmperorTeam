'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useReady } from '@/components/Store';
import { useUI } from '@/components/Shell';
import { monthLine } from '@/components/ProfileDrawer';
import { Avatar, Badge, Breakdown, RankBadge, PageHead } from '@/components/ui';
import { InviteLink } from '@/components/InviteLink';
import { RANKS, fd, monthName, monthShort, usd, type Tone } from '@/lib/logic';

const aInk = (a: string) => a === 'Active' ? 'var(--ok)' : a === 'Idle' ? 'var(--warn)' : 'var(--bad)';
const FILTERS = ['All', 'Members', 'Distributors', 'Managers+', 'Inactive'] as const;
type Filter = typeof FILTERS[number];

export default function Team() {
  const s = useReady();
  const ui = useUI();
  const router = useRouter();
  const params = useSearchParams();
  const { uid, T, I, data, today, m0, me } = s;
  const myDesc = T.desc(uid), isRoot = !me.sponsor_id;
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const want = params.get('focus');
  const focusId = want && (want === uid || myDesc.includes(want)) ? want : uid;
  const setFocus = (id: string) => { setFilter('All'); setQuery(''); router.push(id === uid ? '/team' : `/team?focus=${id}`); };
  const F = I[focusId];
  const mon = monthShort(today);

  if (!myDesc.length) {
    return (
      <>
        <PageHead title={isRoot ? 'Organisation' : 'My Team'} sub="Team counts include everyone below a person on every level, plus themselves." />
        <div className="card flex flex-col items-start gap-2" style={{ padding: 28 }}>
          <span className="card-title">No one in your team yet</span>
          <span className="muted">When someone signs up with you as their sponsor, they appear here and you&apos;re notified.</span>
          <InviteLink id={uid} />
        </div>
      </>
    );
  }

  const chain = [focusId, ...T.ups(focusId)];
  const crumbs = chain.slice(0, chain.indexOf(uid) + 1).reverse();
  const depthOf = (id: string) => { let d = 0, c = id; while (c !== focusId && I[c]?.sponsor_id) { d++; c = I[c].sponsor_id!; } return d; };
  const TF: Record<Filter, (x: string) => boolean> = {
    All: () => true, Members: x => I[x].status_rank === 0, Distributors: x => I[x].status_rank === 1, 'Managers+': x => I[x].status_rank >= 2, Inactive: x => I[x].activity !== 'Active'
  };
  const flat = filter !== 'All' || !!query;
  const rows: { id: string; depth: number }[] = [];
  if (!flat) { const walk = (id: string, d: number) => { rows.push({ id, depth: d }); if (!closed[id]) (T.kids[id] || []).forEach(k => walk(k, d + 1)); }; walk(focusId, 0); }
  else F.team.filter(TF[filter]).filter(x => !query || I[x].name.toLowerCase().includes(query.toLowerCase())).forEach(id => rows.push({ id, depth: 0 }));

  const legs = T.kids[focusId] || [];
  const fOrders = data.orders.filter(o => F.team.includes(o.member_id) && o.order_date >= m0).sort((a, b) => b.order_date.localeCompare(a.order_date));
  const fLive = fOrders.filter(o => o.status !== 'Cancelled');
  const teamName = focusId === uid ? (isRoot ? 'Whole organisation' : 'Your team') : `${F.name}’s team`;
  const stats = [
    ['Team size', F.team.length], ['Direct legs', legs.length], ['Distributors+', F.team.filter(x => I[x].status_rank >= 1).length], ['Members', F.team.filter(x => I[x].status_rank === 0).length],
    ['Team earnings · ' + mon, usd(F.teamEarn)], ['Total QPV · ' + mon, F.teamQ], ['People with orders', F.team.filter(x => I[x].ordN > 0).length]
  ] as const;
  const toggle = (id: string) => setClosed(c => ({ ...c, [id]: !c[id] }));
  const tone = (st: string): Tone => st === 'Completed' ? 'ok' : st === 'Active' ? 'info' : 'bad';
  const first = (id: string | null) => id ? I[id]?.first || '—' : '—';
  const COLS = 'minmax(230px,1.5fr) 160px 70px 76px 56px 60px 90px 104px 80px';

  return (
    <>
      <PageHead title={isRoot ? 'Organisation' : 'My Team'} sub="Team counts include everyone below a person on every level, plus themselves." />
      <div className="flex flex-wrap items-center gap-1.5" style={{ fontSize: 13 }}>
        {crumbs.map(id => {
          const on = id === focusId;
          return <button key={id} type="button" onClick={() => setFocus(id)} style={{ height: 28, padding: '0 10px', borderRadius: 14, border: '1px solid var(--line2)', background: on ? 'var(--ink)' : 'var(--panel)', color: on ? 'var(--bg)' : 'var(--ink)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>{id === uid ? (isRoot ? 'Organisation' : 'My team') : `${I[id].first}’s team`}</button>;
        })}
      </div>
      <div className="card flex flex-col gap-4" style={{ padding: 20 }}>
        <div className="flex flex-wrap items-center gap-3.5">
          <Avatar p={F} size={48} font={16} />
          <div className="flex flex-col" style={{ flex: '1 1 200px' }}><span style={{ fontWeight: 700, fontSize: 17 }}>{teamName}</span><span className="muted" style={{ fontSize: 13 }}>{F.rLabel} · {monthLine(F)} · Sponsor: {F.sponsorName}</span></div>
          <button type="button" className="btn btn-s" style={{ height: 32, padding: '0 12px', borderRadius: 8, fontSize: 12.5 }} onClick={() => ui.openDetail(focusId)}>Profile</button>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
          {stats.map(([k, v]) => <div key={k} className="stat" style={{ padding: 12, gap: 2 }}><span className="stat-label">{k}</span><span className="tnum" style={{ fontSize: 19, fontWeight: 700 }}>{v}</span></div>)}
        </div>
        <Breakdown size={30} items={RANKS.map((r, i) => ({ label: r + 's', count: F.team.filter(x => I[x].status_rank === i).length, rank: i }))} />
      </div>

      {legs.length > 0 && <>
        <span className="card-title">{focusId === uid ? 'Direct legs' : `${F.first}’s direct legs`}</span>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,250px),1fr))' }}>
          {legs.map(id => {
            const p = I[id], wo = p.team.filter(x => I[x].ordN > 0).length;
            return (
              <button key={id} type="button" onClick={() => setFocus(id)} className="card flex flex-col gap-2.5 text-left" style={{ padding: 14, cursor: 'pointer', color: 'var(--ink)' }}>
                <div className="flex w-full items-center gap-2.5">
                  <Avatar p={p} size={34} font={12} />
                  <div className="flex min-w-0 flex-1 flex-col"><span style={{ fontWeight: 600 }}>{p.name}</span><span style={{ fontSize: 11.5, fontWeight: 700, color: p.rInk === 'var(--bg)' || p.rInk === 'var(--panel)' ? 'var(--ink)' : p.rInk }}>{p.rLabel}</span></div>
                  <span className="muted" style={{ fontSize: 16 }}>›</span>
                </div>
                <div className="grid w-full grid-cols-3 gap-1.5">
                  {[['Total QPV', p.teamQ], ['With orders', `${wo}/${p.team.length}`], ['Earnings', usd(p.teamEarn)]].map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--sunk)', borderRadius: 8, padding: '7px 8px', display: 'flex', flexDirection: 'column' }}><span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{k}</span><span style={{ fontWeight: 700 }}>{v}</span></div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </>}

      <div className="flex flex-wrap items-center gap-2">
        <input className="input" style={{ flex: '1 1 200px', height: 36 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name" aria-label="Search team" />
        {FILTERS.map(k => <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{k === 'All' ? 'Tree' : k} <span style={{ opacity: .7 }}>{F.team.filter(TF[k]).length}</span></button>)}
      </div>

      {ui.narrow ? (
        <div className="card overflow-hidden">
          {rows.map(({ id, depth }) => {
            const p = I[id], kidsN = (T.kids[id] || []).length;
            return (
              <div key={id} className="flex items-start gap-2" style={{ padding: `10px 12px 10px ${4 + Math.min(depth, 5) * 14}px`, borderBottom: '1px solid var(--line)', background: id === uid ? 'var(--acc-soft)' : undefined }}>
                <button type="button" onClick={() => toggle(id)} aria-label="Expand or collapse" style={{ width: 22, height: 32, border: 'none', background: 'none', color: 'var(--mut)', cursor: 'pointer', fontSize: 11, padding: 0, flex: 'none', visibility: !flat && kidsN ? 'visible' : 'hidden' }}>{closed[id] ? '▸' : '▾'}</button>
                <Avatar p={p} size={32} font={11} />
                <div role="button" tabIndex={0} onClick={() => ui.openDetail(id)} onKeyDown={e => e.key === 'Enter' && ui.openDetail(id)} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-2"><span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span><span className="tnum" style={{ fontWeight: 700, flex: 'none' }}>{usd(p.teamEarn)}</span></div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: p.rBg, color: p.rInk }}>{p.rLabel}</span>
                    <span className="muted" style={{ fontSize: 11.5 }}>{p.teamQ} QPV · team {p.team.length} · orders {p.ordN || '—'}</span>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: aInk(p.activity) }} />
                  </div>
                </div>
              </div>
            );
          })}
          {!rows.length && <div className="empty" style={{ padding: 30 }}>No one matches.</div>}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <div style={{ minWidth: 1060 }}>
            <div className="grid gap-2" style={{ gridTemplateColumns: COLS, padding: '11px 16px', borderBottom: '1px solid var(--line)', color: 'var(--mut)', fontSize: 12, fontWeight: 600 }}>
              <span>Name</span><span>Status</span><span className="text-right">Own QPV</span><span className="text-right">Total QPV</span><span className="text-right">Team</span><span className="text-right">Orders</span><span className="text-right">Personal</span><span className="text-right">Team earnings</span><span>Activity</span>
            </div>
            {rows.map(({ id, depth }) => {
              const p = I[id], kidsN = (T.kids[id] || []).length;
              return (
                <div key={id} className="grid items-center gap-2" style={{ gridTemplateColumns: COLS, padding: '9px 16px', borderBottom: '1px solid var(--line)', background: id === uid ? 'var(--acc-soft)' : undefined }}>
                  <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 22 }}>
                    <button type="button" onClick={() => toggle(id)} aria-label="Expand or collapse" style={{ width: 20, height: 20, border: 'none', background: 'none', color: 'var(--mut)', cursor: 'pointer', fontSize: 11, padding: 0, flex: 'none', visibility: !flat && kidsN ? 'visible' : 'hidden' }}>{closed[id] ? '▸' : '▾'}</button>
                    <Avatar p={p} size={28} font={10.5} />
                    <div className="flex min-w-0 flex-col">
                      <button type="button" className="link" onClick={() => ui.openDetail(id)} style={{ fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</button>
                      <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{id === focusId ? 'Team root' : `Level ${depthOf(id)} · sponsor ${first(p.sponsor_id)}`}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-0.5"><RankBadge rank={p.status_rank} small />{p.mr < p.status_rank && <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>This month: {RANKS[p.mr]}</span>}</div>
                  <span className="tnum muted text-right">{p.q}</span>
                  <span className="tnum text-right" style={{ fontWeight: 700 }}>{p.teamQ}</span>
                  <button type="button" onClick={() => setFocus(id)} className="link tnum text-right" style={{ fontWeight: 600 }}>{p.team.length}</button>
                  <span className="tnum text-right" style={{ fontWeight: 600, color: p.ordN ? 'var(--ok)' : 'var(--mut)' }}>{p.ordN || '—'}</span>
                  <span className="tnum text-right">{usd(p.personal)}</span>
                  <span className="tnum text-right" style={{ fontWeight: 600 }}>{usd(p.teamEarn)}</span>
                  <span className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, color: aInk(p.activity) }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: aInk(p.activity) }} />{p.activity}</span>
                </div>
              );
            })}
            {!rows.length && <div className="empty" style={{ padding: 30 }}>No one matches.</div>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <span className="card-title">Orders in {teamName} · {monthName(today)}</span>
        <span className="muted" style={{ fontSize: 12.5 }}>{new Set(fLive.map(o => o.member_id)).size} of {F.team.length} people have orders · {fLive.length} orders · {usd(fLive.reduce((t, o) => t + o.amount, 0))}</span>
      </div>
      {ui.narrow ? (
        <div className="card overflow-hidden">
          {fOrders.map(o => {
            const p = I[o.member_id];
            return (
              <div key={o.id} role="button" tabIndex={0} onClick={() => ui.openDetail(o.member_id)} className="flex cursor-pointer items-center gap-2.5" style={{ padding: '11px 12px', borderBottom: '1px solid var(--line)' }}>
                <Avatar p={p} size={30} font={10.5} />
                <div className="flex min-w-0 flex-1 flex-col"><span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.project}</span><span className="muted" style={{ fontSize: 12 }}>{p.name} · {o.platform} · {fd(o.order_date)}</span></div>
                <div className="flex flex-none flex-col items-end gap-0.5"><span style={{ fontWeight: 700, textDecoration: o.status === 'Cancelled' ? 'line-through' : 'none' }}>{usd(o.amount)}</span><Badge tone={tone(o.status)} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 5 }}>{o.status}</Badge></div>
              </div>
            );
          })}
          {!fOrders.length && <div className="empty" style={{ padding: 30 }}>No orders in this team yet this month.</div>}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead><tr>{['Member', 'Sponsor', 'Project', 'Platform', 'Date'].map(h => <th key={h} className="th">{h}</th>)}<th className="th" style={{ textAlign: 'right' }}>Amount</th><th className="th">Status</th></tr></thead>
            <tbody>
              {fOrders.map(o => {
                const p = I[o.member_id];
                return (
                  <tr key={o.id}>
                    <td className="td" style={{ padding: '10px 16px' }}><button type="button" onClick={() => ui.openDetail(o.member_id)} className="link flex items-center gap-2" style={{ color: 'var(--ink)', fontWeight: 600 }}><Avatar p={p} size={26} font={10} />{p.name}</button></td>
                    <td className="td muted" style={{ padding: '10px 16px' }}>{first(p.sponsor_id)}</td>
                    <td className="td" style={{ padding: '10px 16px' }}>{o.project}</td>
                    <td className="td" style={{ padding: '10px 16px' }}>{o.platform}</td>
                    <td className="td muted" style={{ padding: '10px 16px' }}>{fd(o.order_date)}</td>
                    <td className="td tnum" style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, textDecoration: o.status === 'Cancelled' ? 'line-through' : 'none' }}>{usd(o.amount)}</td>
                    <td className="td" style={{ padding: '10px 16px' }}><Badge tone={tone(o.status)}>{o.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!fOrders.length && <div className="empty" style={{ padding: 30 }}>No orders in this team yet this month.</div>}
        </div>
      )}
    </>
  );
}
