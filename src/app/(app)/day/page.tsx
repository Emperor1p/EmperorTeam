'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useReady } from '@/components/Store';
import { Check } from '@/components/ui';
import { addDays, clock, fdLong, fdw } from '@/lib/logic';

const CI = [['fiverr_msgs', 'Fiverr messages today'], ['upwork_msgs', 'Upwork messages today'], ['orders', 'Orders today'], ['cancellations', 'Cancellations today']] as const;
type Num = typeof CI[number][0];

export default function MyDay() {
  const s = useReady();
  const { uid, data, today, sb } = s;
  const [viewDay, setViewDay] = useState(today);
  const [todoIn, setTodoIn] = useState('');
  const myLog = data.logs.find(l => l.member_id === uid && l.log_date === today);
  const book = data.books.find(b => b.member_id === uid)?.title || '';
  const blank = { fiverr_msgs: '', upwork_msgs: '', orders: '', cancellations: '', progress: '', issue: '', book };
  const [ci, setCi] = useState(blank);
  const [ciEdit, setCiEdit] = useState(false);
  const [ciErr, setCiErr] = useState('');
  useEffect(() => { setViewDay(today); }, [today]);
  useEffect(() => { setCi(c => ({ ...c, book: c.book || book })); }, [book]);

  // ── To-dos ──
  const allTodos = data.todos.filter(t => t.member_id === uid);
  const dayT = (d: string) => allTodos.filter(t => t.todo_date === d);
  const myTodos = dayT(today), todoDone = myTodos.filter(t => t.done).length;
  const days7 = Array.from({ length: 7 }, (_, k) => addDays(today, -k));
  const weekT = allTodos.filter(t => t.todo_date >= days7[6]);
  let streak = 0;
  for (let k = 0; k < 60; k++) { const l = dayT(addDays(today, -k)); if (l.length && l.every(t => t.done)) streak++; else if (k === 0) continue; else break; }
  const isToday = viewDay === today, viewList = dayT(viewDay);

  const addTodo = async (e: FormEvent) => {
    e.preventDefault();
    const t = todoIn.trim(); if (!t) return;
    setTodoIn('');
    await s.run(sb.from('todos').insert({ member_id: uid, todo_date: today, body: t }), undefined, 'todos');
  };
  const toggle = (id: string, done: boolean) => s.run(sb.from('todos').update({ done: !done, done_at: !done ? new Date().toISOString() : null }).eq('id', id), undefined, 'todos');
  const remove = (id: string) => s.run(sb.from('todos').delete().eq('id', id), undefined, 'todos');
  const moveToday = async (id: string, body: string) => {
    const ok = await s.run(sb.from('todos').update({ moved: true }).eq('id', id));
    if (ok) await s.run(sb.from('todos').insert({ member_id: uid, todo_date: today, body }), 'Moved to today', 'todos');
  };

  // ── Check-in ──
  const showForm = !myLog || ciEdit;
  const startEdit = () => {
    if (!myLog) return;
    setCi({ fiverr_msgs: String(myLog.fiverr_msgs), upwork_msgs: String(myLog.upwork_msgs), orders: String(myLog.orders), cancellations: String(myLog.cancellations), progress: myLog.progress, issue: '', book });
    setCiEdit(true);
  };
  const submitCi = async (e: FormEvent) => {
    e.preventDefault();
    const nums = {} as Record<Num, number>;
    for (const [k, label] of CI) {
      const v = ci[k] === '' ? 0 : Number(ci[k]);
      if (!Number.isInteger(v) || v < 0) return setCiErr(`${label} must be a whole number, 0 or more.`);
      nums[k] = v;
    }
    if (ci.progress.trim().length < 3) return setCiErr('Write a line about your daily progress.');
    const row = { member_id: uid, log_date: today, ...nums, progress: ci.progress.trim(), ...(myLog ? { updated_at: new Date().toISOString() } : {}) };
    const ok = await s.run(sb.from('daily_logs').upsert(row, { onConflict: 'member_id,log_date' }));
    if (!ok) return;
    if (ci.book.trim() && ci.book.trim() !== book) await s.run(sb.from('books').upsert({ member_id: uid, month: s.m0, title: ci.book.trim() }, { onConflict: 'member_id,month' }));
    const hasIssue = ci.issue.trim().length >= 5;
    if (hasIssue) await s.run(sb.from('issues').insert({ member_id: uid, body: ci.issue.trim() }));
    setCiEdit(false); setCi(c => ({ ...c, issue: '' }));
    await s.refresh('logs', 'books', 'issues');
    s.say(hasIssue ? 'Check-in saved · issue sent to your upline' : myLog ? 'Check-in updated' : 'Check-in submitted');
  };
  const setField = (k: keyof typeof ci) => (e: { target: { value: string } }) => { const v = e.target.value; setCi(c => ({ ...c, [k]: v })); setCiErr(''); };

  return (
    <>
      <div className="flex flex-col gap-1"><h1 className="h1">My Day</h1><span className="muted">{fdLong(today)} · Lagos {clock()} · Missing check-ins and to-do lists get a reminder at 9:00 PM.</span></div>
      <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))' }}>
        <div className="card flex flex-col gap-3" style={{ padding: 20 }}>
          <div className="flex items-baseline justify-between gap-2"><span className="card-title">To-do list</span><span className="muted" style={{ fontSize: 12.5 }}>{isToday ? `${todoDone} of ${myTodos.length} done today` : `${viewList.filter(t => t.done).length} of ${viewList.length} done`}</span></div>
          <div className="grid grid-cols-2 gap-2">
            {[['Today', `${todoDone}/${myTodos.length}`], ['Last 7 days done', weekT.length ? Math.round(weekT.filter(t => t.done).length / weekT.length * 100) + '%' : '—'], ['Days with a list', `${days7.filter(d => dayT(d).length).length}/7`], ['All-done streak', `${streak} day${streak === 1 ? '' : 's'}`]].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--sunk)', borderRadius: 10, padding: '9px 11px', display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 11.5, fontWeight: 600 }} className="muted">{k}</span><span className="tnum" style={{ fontSize: 18, fontWeight: 700 }}>{v}</span></div>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto" style={{ paddingBottom: 2, margin: '0 -2px' }}>
            {days7.map(d => {
              const l = dayT(d), on = d === viewDay, all = l.length && l.every(t => t.done);
              return (
                <button key={d} type="button" onClick={() => setViewDay(d)} aria-pressed={on} style={{ flex: 'none', minWidth: 58, height: 46, borderRadius: 10, border: `1px solid ${on ? 'var(--ink)' : 'var(--line2)'}`, background: on ? 'var(--ink)' : 'var(--panel)', color: on ? 'var(--bg)' : 'var(--ink)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '0 8px' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{d === today ? 'Today' : fdw(d).split(' ')[0].replace(',', '') + ' ' + Number(d.slice(8))}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? 'var(--bg)' : all ? 'var(--ok)' : 'var(--mut)' }}>{l.length ? `${l.filter(t => t.done).length}/${l.length}` : '—'}</span>
                </button>
              );
            })}
          </div>
          {isToday ? (
            <form onSubmit={addTodo} className="flex gap-2">
              <input className="input" style={{ flex: 1, height: 40 }} value={todoIn} onChange={e => setTodoIn(e.target.value)} placeholder="Add something to do today" aria-label="New to-do" maxLength={300} />
              <button type="submit" className="btn btn-ink" style={{ height: 40 }}>Add</button>
            </form>
          ) : <span className="muted" style={{ fontSize: 12.5 }}>Viewing {fdw(viewDay)}. Past lists are read-only. Move unfinished items to today.</span>}
          {viewList.map(t => {
            const note = t.moved ? 'Moved to today' : t.done && t.done_at ? `Done ${clock(t.done_at)}` : !isToday && !t.done ? 'Not done' : '';
            return (
              <div key={t.id} className="flex items-center gap-2.5" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                <Check done={t.done} onClick={isToday ? () => toggle(t.id, t.done) : undefined} disabled={!isToday} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done || t.moved ? 'var(--mut)' : 'var(--ink)', wordBreak: 'break-word' }}>{t.body}</span>
                  {note && <span style={{ fontSize: 11.5, fontWeight: 600, color: !isToday && !t.done && !t.moved ? 'var(--bad)' : 'var(--mut)' }}>{note}</span>}
                </div>
                {isToday && <button type="button" className="btn btn-s" style={{ height: 30, padding: '0 10px', fontSize: 12, borderRadius: 8 }} onClick={() => remove(t.id)}>Remove</button>}
                {!isToday && !t.done && !t.moved && <button type="button" className="btn btn-s" style={{ height: 30, padding: '0 10px', fontSize: 12, borderRadius: 8 }} onClick={() => moveToday(t.id, t.body)}>Move to today</button>}
              </div>
            );
          })}
          {!viewList.length && <span className="muted" style={{ fontSize: 13 }}>{isToday ? 'No to-dos yet today. Add your first one above.' : 'No to-do list on this day.'}</span>}
          <span className="muted" style={{ fontSize: 12 }}>Your sponsor and upline can see today&apos;s list on your profile. Missing lists get a reminder at 9:00 PM.</span>
        </div>

        <div className="card flex flex-col gap-3.5" style={{ padding: 20 }}>
          <div className="flex items-baseline justify-between gap-2"><span className="card-title">Daily check-in</span><span className="muted" style={{ fontSize: 12.5 }}>{myLog ? `Submitted ${clock(myLog.created_at)}${myLog.updated_at ? ` · edited ${clock(myLog.updated_at)}` : ''}` : 'Not submitted yet'}</span></div>
          {showForm ? (
            <form onSubmit={submitCi} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5">
                {CI.map(([k, label]) => <label key={k} className="field">{label}<input className="input" type="number" min={0} step={1} value={ci[k]} onChange={setField(k)} placeholder="0" /></label>)}
              </div>
              <label className="field">Daily progress<textarea className="input" rows={3} value={ci.progress} onChange={setField('progress')} placeholder="What did you get done today?" /></label>
              <label className="field">Any issue? (sent to your sponsor and upline)<textarea className="input" rows={2} value={ci.issue} onChange={setField('issue')} placeholder="Optional" /></label>
              <label className="field">Book I&apos;m reading this month<input className="input" value={ci.book} onChange={setField('book')} placeholder="Title and author" /></label>
              {ciErr && <span role="alert" className="err">{ciErr}</span>}
              <div className="flex gap-2">
                <button type="submit" className="btn btn-p" style={{ height: 38, padding: '0 16px' }}>{myLog ? 'Save changes' : 'Submit check-in'}</button>
                {ciEdit && <button type="button" className="btn btn-s" style={{ height: 38 }} onClick={() => setCiEdit(false)}>Cancel</button>}
              </div>
            </form>
          ) : myLog && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                {CI.map(([k, label]) => <div key={k} className="stat"><span className="stat-label">{label}</span><span style={{ fontSize: 20, fontWeight: 700 }}>{myLog[k]}</span></div>)}
              </div>
              <div className="flex flex-col gap-0.5"><span className="stat-label">Daily progress</span><span style={{ whiteSpace: 'pre-wrap' }}>{myLog.progress}</span></div>
              <div className="flex flex-col gap-0.5"><span className="stat-label">Book this month</span><span>{book || '—'}</span></div>
              <button type="button" className="btn btn-s" style={{ alignSelf: 'flex-start', height: 32, padding: '0 13px', borderRadius: 8, fontSize: 13 }} onClick={startEdit}>Edit check-in</button>
            </>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead><tr>{[['Day', 'left'], ['Check-in', 'left'], ['Fiverr msgs', 'right'], ['Upwork msgs', 'right'], ['Orders', 'right'], ['Cancellations', 'right'], ['To-dos', 'right']].map(([h, a]) => <th key={h} className="th" style={{ textAlign: a as 'left' | 'right' }}>{h}</th>)}</tr></thead>
          <tbody>
            {days7.map(d => {
              const l = data.logs.find(x => x.member_id === uid && x.log_date === d), td = dayT(d);
              const c = (v: string | number, extra: React.CSSProperties = {}) => <td className="td tnum" style={{ textAlign: 'right', padding: '11px 16px', ...extra }}>{v}</td>;
              return (
                <tr key={d}>
                  {c(fdw(d), { textAlign: 'left', fontWeight: 600 })}
                  {c(l ? 'Checked in' : 'Missed', { textAlign: 'left', fontWeight: 600, color: l ? 'var(--ok)' : 'var(--bad)' })}
                  {c(l ? l.fiverr_msgs : '—')}{c(l ? l.upwork_msgs : '—')}{c(l ? l.orders : '—')}{c(l ? l.cancellations : '—')}
                  {c(td.length ? `${td.filter(t => t.done).length}/${td.length}` : '—')}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
