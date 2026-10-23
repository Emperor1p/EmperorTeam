'use client';
import { useReady } from '@/components/Store';
import { useUI } from '@/components/Shell';
import { Avatar, Metric, PageHead } from '@/components/ui';
import { daysBetween, lagosDateOf } from '@/lib/logic';

export default function Activity() {
  const s = useReady();
  const ui = useUI();
  const { uid, T, I, data, today, nameOf } = s;
  const myDesc = T.desc(uid);
  const ago = (id: string) => daysBetween(lagosDateOf(I[id].last_active_at), today);
  const noLog = (id: string) => !data.logs.some(l => l.member_id === id && l.log_date === today);
  const noTodo = (id: string) => !data.todos.some(t => t.member_id === id && t.todo_date === today);
  const missed = myDesc.filter(id => noLog(id) || noTodo(id));
  const idle = myDesc.filter(x => I[x].activity === 'Idle'), inact = myDesc.filter(x => I[x].activity === 'Inactive');
  const groups = [
    { title: 'Missed today', rule: 'Reminder at 9:00 PM', ink: 'var(--warn)', rows: missed.map(id => ({ id, reason: [noLog(id) && 'No check-in', noTodo(id) && 'No to-do list'].filter(Boolean).join(' · ') })) },
    { title: 'Not active for a week', rule: '7–13 days · reminder sent', ink: 'var(--warn)', rows: idle.map(id => ({ id, reason: `${ago(id)} days` })) },
    { title: 'Inactive members', rule: '2+ weeks · told they are now inactive', ink: 'var(--bad)', rows: inact.map(id => ({ id, reason: `${Math.floor(ago(id) / 7)} weeks` })) }
  ];
  if (!myDesc.length) return <PageHead title="Activity" sub="This page shows your team's activity once someone joins your team." />;
  return (
    <>
      <PageHead title="Activity" sub="Checked automatically every day at 9:00 PM Lagos time. Active = activity in the last 7 days." />
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
        <Metric label="Active this week" value={String(myDesc.filter(x => I[x].activity === 'Active').length)} sub={`of ${myDesc.length} in your team`} ink="var(--ok)" />
        <Metric label="Missed today" value={String(missed.length)} sub="Check-in or to-do" ink="var(--warn)" />
        <Metric label="Idle 1 week" value={String(idle.length)} sub="7–13 days" ink="var(--warn)" />
        <Metric label="Inactive" value={String(inact.length)} sub="2+ weeks" ink="var(--bad)" />
      </div>
      {groups.map(g => (
        <div key={g.title} className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2.5"><span className="card-title">{g.title}</span><span className="muted" style={{ fontSize: 12.5 }}>{g.rule}</span></div>
          <div className="card overflow-hidden">
            {g.rows.map(({ id, reason }) => {
              const p = I[id], a = ago(id);
              return (
                <div key={id} className="flex flex-wrap items-center gap-3" style={{ padding: '11px 18px', borderBottom: '1px solid var(--line)' }}>
                  <Avatar p={p} size={30} font={11} />
                  <div className="flex min-w-0 flex-col" style={{ flex: '1 1 200px' }}>
                    <button type="button" className="link" onClick={() => ui.openDetail(id)} style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.name}</button>
                    <span className="muted" style={{ fontSize: 12.5 }}>Sponsor {p.sponsor_id ? nameOf[p.sponsor_id] : '—'} · last active {a === 0 ? 'today' : `${a} days ago`}</span>
                  </div>
                  <span style={{ fontSize: 12.5, color: g.ink, fontWeight: 600 }}>{reason}</span>
                </div>
              );
            })}
            {!g.rows.length && <div className="empty" style={{ padding: 20, fontSize: 13 }}>No one.</div>}
          </div>
        </div>
      ))}
    </>
  );
}
