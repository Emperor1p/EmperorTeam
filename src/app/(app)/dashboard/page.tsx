'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useReady } from '@/components/Store';
import { monthLine } from '@/components/ProfileDrawer';
import { Avatar, Breakdown, Metric, RankBadge } from '@/components/ui';
import { InviteLink } from '@/components/InviteLink';
import { RANKS, TH, clock, fdLong, fdw, greeting, lagosDateOf, monthShort, nextMonthStart, sum, usd, weekStart, fd } from '@/lib/logic';

export default function Dashboard() {
  const s = useReady();
  const router = useRouter();
  const [qIn, setQIn] = useState('');
  const { me, uid, T, I, data, today, live, m0 } = s;
  const myDesc = T.desc(uid), hasTeam = myDesc.length > 0, isRoot = !me.sponsor_id;
  const mon = monthShort(today), w0 = weekStart(today);

  const nextRank = me.mr < 5 && me.status_rank < 6 ? me.mr + 1 : null;
  const split = `Your own ${me.q} + team ${me.teamQ - me.q}`;
  const qpvCard = me.status_rank >= 1
    ? { title: 'Total QPV this month', pct: nextRank ? Math.min(100, Math.round(me.teamQ / TH[nextRank] * 100)) : 100, sub: `${split} · ${nextRank ? `${TH[nextRank] - me.teamQ} to reach ${RANKS[nextRank]}${me.mr < me.status_rank ? `, your status stays ${RANKS[me.status_rank]}` : ''}` : 'Director level this month'}` }
    : { title: 'Become a distributor', pct: Math.min(100, me.teamQ), sub: `${split} · ${Math.max(0, 100 - me.teamQ)} more QPV to become a Distributor` };

  const addQpv = async (e: FormEvent) => {
    e.preventDefault();
    const v = Number(qIn);
    if (!Number.isInteger(v) || v <= 0) return s.say('Enter a positive whole QPV number.');
    const before = me.status_rank, ups = T.ups(uid).length;
    const { error } = await s.sb.from('qpv_entries').insert({ member_id: uid, amount: v });
    if (error) return s.say(error.message);
    setQIn('');
    await s.refresh('qpv', 'profiles', 'achievements', 'notifs');
    const { data: p } = await s.sb.from('profiles').select('status_rank').eq('id', uid).single();
    const nr = p?.status_rank ?? before;
    s.say(nr > before ? `You stepped up to ${RANKS[nr]}! Your upline has been notified.` : `+${v} QPV · added to you and ${ups} upline${ups === 1 ? '' : 's'}`);
  };

  const myLog = data.logs.find(l => l.member_id === uid && l.log_date === today);
  const myTodos = data.todos.filter(t => t.member_id === uid && t.todo_date === today);
  const myTasksOpen = data.tasks.filter(t => t.assignee_id === uid && !t.done).length;
  const meetings = data.meetings.filter(m => lagosDateOf(m.starts_at) >= today).slice(0, 2);

  const scope = hasTeam ? [uid, ...myDesc] : [uid];
  const ordersIn = (from: string) => live.filter(o => scope.includes(o.member_id) && o.order_date >= from);
  const oW = ordersIn(w0), oM = ordersIn(m0);
  const missed = myDesc.filter(id => !data.logs.some(l => l.member_id === id && l.log_date === today) || !data.todos.some(t => t.member_id === id && t.todo_date === today));
  const visIssues = data.issues.filter(i => i.member_id !== uid && T.ups(i.member_id).includes(uid) && i.status === 'Open');
  const go = (p: string) => () => router.push(p);
  const breakdown = RANKS.map((r, i) => ({ label: r + 's', count: scope.filter(x => I[x].status_rank === i).length, rank: i }));
  const teamCards = [
    { label: 'Team size', value: String(scope.length), sub: `${scope.filter(x => I[x].status_rank >= 1).length} distributors+ · ${scope.filter(x => I[x].status_rank === 0).length} members`, go: go('/team') },
    { label: 'Active members', value: String(scope.filter(x => I[x].activity === 'Active').length), sub: `${scope.filter(x => I[x].activity === 'Inactive').length} inactive · ${scope.filter(x => I[x].activity === 'Idle').length} idle 1 week`, go: go('/activity') },
    { label: `Team earnings · ${mon}`, value: usd(me.teamEarn), sub: `You ${usd(me.personal)} + team ${usd(me.teamEarn - me.personal)}`, go: go('/orders?tab=team&range=month') },
    { label: `Total QPV · ${mon}`, value: String(me.teamQ), sub: `You ${me.q} + team ${me.teamQ - me.q} · resets ${fd(nextMonthStart(today))}`, go: go('/team') },
    { label: 'Orders this week', value: `${oW.length} · ${usd(sum(oW, o => o.amount))}`, sub: `${new Set(oW.map(o => o.member_id)).size} people collected orders`, go: go('/orders?tab=team&range=week') },
    { label: 'Orders this month', value: `${oM.length} · ${usd(sum(oM, o => o.amount))}`, sub: `${new Set(oM.map(o => o.member_id)).size} people collected orders`, go: go('/orders?tab=team&range=month') },
    { label: 'Missed check-in / to-do', value: String(missed.length), sub: 'Today so far', go: go('/activity') },
    { label: 'Open issues', value: String(visIssues.length), sub: 'From your team', go: go('/issues') }
  ];
  const todayDone = myLog && myTodos.length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="h1">{greeting()}, {me.first}</h1>
          <div className="flex flex-wrap items-center gap-2" style={{ color: 'var(--mut)', fontSize: 13 }}>
            <RankBadge rank={me.status_rank} /><span>{monthLine(me)}</span><span>· Sponsor: {me.sponsorName}</span>
          </div>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>{fdLong(today)} · Lagos {clock()}</span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' }}>
        <div className="card flex flex-col gap-3" style={{ padding: 20 }}>
          <div className="flex items-baseline justify-between gap-2"><span className="card-title">{qpvCard.title}</span><span className="muted" style={{ fontSize: 12.5 }}>{new Date(today + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })} · resets to 0 on {fd(nextMonthStart(today))}</span></div>
          <div className="flex items-baseline gap-1.5"><span className="tnum" style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }}>{me.teamQ}</span><span className="muted" style={{ fontWeight: 600 }}>QPV</span></div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--sunk)', overflow: 'hidden' }}><div style={{ height: '100%', width: qpvCard.pct + '%', background: 'var(--acc)', borderRadius: 4, transition: 'width .3s' }} /></div>
          <span className="muted" style={{ fontSize: 12.5 }}>{qpvCard.sub}</span>
          <form onSubmit={addQpv} className="flex gap-2">
            <input className="input" style={{ flex: 1, height: 36 }} type="number" min={1} step={1} value={qIn} onChange={e => setQIn(e.target.value)} placeholder="Add QPV collected" aria-label="QPV to add" />
            <button type="submit" className="btn btn-p">Add QPV</button>
          </form>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label={`Personal earnings · ${mon}`} value={usd(me.personal)} sub={`${live.filter(o => o.member_id === uid && o.order_date >= m0).length} orders`} onClick={go('/orders?tab=mine')} />
          <Metric label={`Team earnings · ${mon}`} value={usd(me.teamEarn)} sub={hasTeam ? `Team adds ${usd(me.teamEarn - me.personal)}` : 'Same as personal'} onClick={go(`/orders?tab=${hasTeam ? 'team' : 'mine'}`)} />
          <Metric label="My team" value={String(me.team.length)} sub={`${(T.kids[uid] || []).length} direct legs`} onClick={go('/team')} />
          <Metric label="My tasks" value={String(myTasksOpen)} sub="Open" onClick={go('/tasks')} />
        </div>
        <div className="flex flex-col gap-4">
          <div className="card flex flex-col gap-2" style={{ padding: 20, background: todayDone ? 'var(--panel)' : 'var(--acc-soft)' }}>
            <span className="card-title">Today</span>
            <span style={{ fontSize: 13.5 }}>{myTodos.length ? `To-do: ${myTodos.filter(t => t.done).length} of ${myTodos.length} done` : 'To-do list: not started'}</span>
            <span style={{ fontSize: 13.5 }}>{myLog ? `Check-in submitted at ${clock(myLog.created_at)}` : 'Daily check-in: not submitted'}</span>
            <button type="button" className="btn btn-p btn-md" style={{ alignSelf: 'flex-start', marginTop: 4, height: 34 }} onClick={go('/day')}>Open My Day</button>
          </div>
          <div className="card flex flex-col gap-2.5" style={{ padding: 20 }}>
            <div className="flex items-baseline justify-between"><span className="card-title">Upcoming meetings</span><button type="button" className="link" onClick={go('/meetings')} style={{ fontSize: 13, fontWeight: 600 }}>All</button></div>
            {meetings.map(m => (
              <div key={m.id} className="flex items-center gap-2.5" style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                <div className="flex min-w-0 flex-1 flex-col"><span style={{ fontWeight: 600 }}>{m.title}</span><span className="muted" style={{ fontSize: 12.5 }}>{fdw(lagosDateOf(m.starts_at))} · {clock(m.starts_at)} · {m.host_id === uid ? 'you' : s.nameOf[m.host_id] || 'host'}</span></div>
                <a href={m.meet_link} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ background: 'var(--acc-soft)', color: 'var(--acc-text)' }}>Join</a>
              </div>
            ))}
            {!meetings.length && <span className="muted" style={{ fontSize: 13 }}>No meetings scheduled.</span>}
          </div>
        </div>
      </div>

      {hasTeam && <>
        <div className="flex flex-wrap items-baseline justify-between gap-2.5" style={{ paddingTop: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>{isRoot ? 'Whole organisation' : 'Your team'}</span>
          <button type="button" className="link" onClick={go('/team')} style={{ fontSize: 13, fontWeight: 600 }}>Open team structure</button>
        </div>
        <Breakdown items={breakdown} />
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
          {teamCards.map(k => <Metric key={k.label} label={k.label} value={k.value} sub={k.sub} onClick={k.go} />)}
        </div>
        <div className="card flex flex-col gap-1" style={{ padding: 20 }}>
          <span className="card-title" style={{ marginBottom: 8 }}>Your direct legs</span>
          {(T.kids[uid] || []).map(id => {
            const p = I[id], wo = p.team.filter(x => I[x].ordN > 0).length;
            return (
              <div key={id} role="button" tabIndex={0} onClick={go(`/team?focus=${id}`)} onKeyDown={e => e.key === 'Enter' && router.push(`/team?focus=${id}`)} className="row-hover flex flex-wrap items-center gap-3" style={{ padding: '10px 0', borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
                <Avatar p={p} size={34} font={12} />
                <div className="flex min-w-0 flex-col" style={{ flex: '1 1 160px' }}><span style={{ fontWeight: 600 }}>{p.name}</span><span className="muted" style={{ fontSize: 12 }}>{p.team.length} in team · {wo} with orders · {p.teamQ} QPV</span></div>
                <RankBadge rank={p.status_rank} />
                <span className="tnum" style={{ width: 110, textAlign: 'right', fontWeight: 600 }}>{usd(p.teamEarn)}</span>
              </div>
            );
          })}
        </div>
      </>}
      {!hasTeam && (
        <div className="card flex flex-col items-start gap-2" style={{ padding: 20 }}>
          <span className="card-title">Grow your team</span>
          <span className="muted">Share your invite link. Anyone who signs up with it joins your team, and you&apos;re notified.</span>
          <InviteLink id={uid} />
        </div>
      )}
    </>
  );
}
