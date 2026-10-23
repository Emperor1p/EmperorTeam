'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useReady } from './Store';
import { MEET_RE, PLATFORMS, RANKS, addDays, usd } from '@/lib/logic';

export type ModalReq =
  | { kind: 'order' } | { kind: 'task'; to?: string } | { kind: 'meeting' } | { kind: 'issue' }
  | { kind: 'reply'; issueId: string } | { kind: 'ach'; who?: string };

export function ModalHost({ req, onClose }: { req: ModalReq; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  switch (req.kind) {
    case 'order': return <OrderForm onClose={onClose} />;
    case 'task': return <TaskForm onClose={onClose} to={req.to} />;
    case 'meeting': return <MeetingForm onClose={onClose} />;
    case 'issue': return <IssueForm onClose={onClose} />;
    case 'reply': return <ReplyForm onClose={onClose} issueId={req.issueId} />;
    case 'ach': return <AchForm onClose={onClose} who={req.who} />;
  }
}

function Frame({ title, sub, btn, err, calc, onClose, onSubmit, busy, children }: { title: string; sub: ReactNode; btn: string; err: string; calc?: ReactNode; onClose: () => void; onSubmit: (e: FormEvent) => void; busy: boolean; children: ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} onSubmit={onSubmit}
        style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', background: 'var(--panel)', borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div className="flex flex-col gap-1"><span style={{ fontWeight: 700, fontSize: 18 }}>{title}</span><span className="muted" style={{ fontSize: 13 }}>{sub}</span></div>
        {children}
        {calc && <div style={{ background: 'var(--sunk)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>{calc}</div>}
        {err && <span role="alert" className="err">{err}</span>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-s" style={{ height: 38, padding: '0 15px' }} onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-p" style={{ height: 38, padding: '0 15px' }} disabled={busy}>{btn}</button>
        </div>
      </form>
    </div>
  );
}

function useForm<T extends Record<string, string | boolean>>(init: T) {
  const [f, setF] = useState(init);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const on = (k: keyof T) => (e: { target: { value: string; checked?: boolean; type?: string } }) => {
    const v = e.target.type === 'checkbox' ? !!e.target.checked : e.target.value;
    setF(x => ({ ...x, [k]: v })); setErr('');
  };
  return { f, on, err, setErr, busy, setBusy };
}

const Input = ({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => <label className="field">{label}<input className="input" {...p} /></label>;
const Area = ({ label, ...p }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <label className="field">{label}<textarea className="input" rows={3} {...p} /></label>;
const Select = ({ label, options, ...p }: { label: string; options: { v: string; l: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <label className="field">{label}<select className="input" {...p}>{options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
);

function useTeamOptions() {
  const s = useReady();
  return s.T.desc(s.uid).map(id => ({ v: id, l: `${s.I[id].name} · ${RANKS[s.I[id].status_rank]}${s.I[id].sponsor_id === s.uid ? ' · direct leg' : ''}` }));
}

function OrderForm({ onClose }: { onClose: () => void }) {
  const s = useReady();
  const { f, on, err, setErr, busy, setBusy } = useForm({ project: '', platform: 'Fiverr', amount: '', date: s.today, status: 'Active' });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(f.amount);
    if (f.project.trim().length < 3) return setErr('Enter the project name.');
    if (!(amt > 0)) return setErr('Amount must be more than $0.');
    if (!f.date || f.date > s.today) return setErr('Order date can’t be in the future.');
    setBusy(true);
    const ok = await s.run(s.sb.from('orders').insert({ member_id: s.uid, project: f.project.trim(), platform: f.platform, amount: Math.round(amt * 100) / 100, order_date: f.date, status: f.status }),
      `Order logged · ${usd(amt)} added to your earnings and your upline’s team earnings`, 'orders');
    setBusy(false); if (ok) onClose();
  };
  return (
    <Frame title="Log an order" sub="Adds to your personal earnings and to the team earnings of everyone above you." btn="Save order" {...{ err, busy, onClose }} onSubmit={submit}>
      <Input label="Project" value={f.project} onChange={on('project')} placeholder="e.g. Logo design for Ade Foods" autoFocus />
      <Select label="Platform" value={f.platform} onChange={on('platform')} options={PLATFORMS.map(v => ({ v, l: v }))} />
      <Input label="Amount (USD)" type="number" min="0" step="0.01" value={f.amount} onChange={on('amount')} placeholder="400" />
      <Input label="Order date" type="date" max={s.today} value={f.date} onChange={on('date')} />
      <Select label="Status" value={f.status} onChange={on('status')} options={['Active', 'Completed'].map(v => ({ v, l: v }))} />
    </Frame>
  );
}

function TaskForm({ onClose, to }: { onClose: () => void; to?: string }) {
  const s = useReady();
  const opts = useTeamOptions();
  const { f, on, err, setErr, busy, setBusy } = useForm({ to: to || opts[0]?.v || '', title: '', due: addDays(s.today, 3) });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!s.T.desc(s.uid).includes(f.to)) return setErr('Choose someone in your team.');
    if (f.title.trim().length < 3) return setErr('Give the task a title.');
    setBusy(true);
    const ok = await s.run(s.sb.from('tasks').insert({ title: f.title.trim(), assignee_id: f.to, assigned_by: s.uid, due_date: f.due || s.today }), `Task assigned to ${s.I[f.to].name}`, 'tasks');
    if (ok) fetch('/api/emails', { method: 'POST' }).catch(() => {});
    setBusy(false); if (ok) onClose();
  };
  return (
    <Frame title="Assign a task" sub="They get an in-app notification and email." btn="Assign" {...{ err, busy, onClose }} onSubmit={submit}>
      <Select label="Assign to" value={f.to} onChange={on('to')} options={opts} />
      <Input label="Task" value={f.title} onChange={on('title')} placeholder="e.g. Send 20 proposals this week" autoFocus />
      <Input label="Due date" type="date" value={f.due} onChange={on('due')} />
    </Frame>
  );
}

function MeetingForm({ onClose }: { onClose: () => void }) {
  const s = useReady();
  const isRoot = !s.me.sponsor_id;
  const myDesc = s.T.desc(s.uid);
  const legTeams = myDesc.filter(id => (s.T.kids[id] || []).length || s.I[id].sponsor_id === s.uid);
  const { f, on, err, setErr, busy, setBusy } = useForm({ title: '', date: addDays(s.today, 2), time: '18:00', aud: 'direct', teamOf: legTeams[0] || '', link: '' });
  const invitees = f.aud === 'direct' ? (s.T.kids[s.uid] || []) : f.aud === 'team' ? (f.teamOf ? [f.teamOf, ...s.T.desc(f.teamOf)] : []) : myDesc;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.title.trim().length < 3) return setErr('Give the meeting a title.');
    if (!f.date || f.date < s.today) return setErr('Pick today or a future date.');
    if (!MEET_RE.test(f.link.trim())) return setErr('Paste a Google Meet link (https://meet.google.com/…).');
    if (!invitees.length) return setErr('No one to invite for this audience.');
    setBusy(true);
    // Times are Lagos time (UTC+1, no daylight saving).
    const startsAt = new Date(`${f.date}T${f.time || '18:00'}:00+01:00`).toISOString();
    const ok = await s.run(s.sb.rpc('create_meeting', { p_title: f.title.trim(), p_starts_at: startsAt, p_audience: f.aud, p_team_of: f.aud === 'team' ? f.teamOf : null, p_link: f.link.trim() }),
      `Invites sent to ${invitees.length} people · email + in-app`, 'meetings');
    if (ok) fetch('/api/emails', { method: 'POST' }).catch(() => {});
    setBusy(false); if (ok) onClose();
  };
  return (
    <Frame title="Schedule a meeting" sub="Everyone invited gets an email with the Meet link and an in-app notification." btn="Send invites" {...{ err, busy, onClose }} onSubmit={submit} calc={`${invitees.length} people will be invited`}>
      <Input label="Title" value={f.title} onChange={on('title')} placeholder="e.g. Weekly training" autoFocus />
      <Input label="Date" type="date" min={s.today} value={f.date} onChange={on('date')} />
      <Input label="Time (Lagos)" type="time" value={f.time} onChange={on('time')} />
      <Select label="Who to invite" value={f.aud} onChange={on('aud')} options={[{ v: 'direct', l: 'My direct legs' }, { v: 'team', l: 'A particular leg’s team' }, { v: 'all', l: isRoot ? 'Entire team' : 'My entire team' }]} />
      {f.aud === 'team' && <Select label="Whose team" value={f.teamOf} onChange={on('teamOf')} options={legTeams.map(id => ({ v: id, l: `${s.I[id].name}’s team (${s.I[id].team.length})` }))} />}
      <label className="field">Google Meet link
        <input className="input" type="url" value={f.link} onChange={on('link')} placeholder="https://meet.google.com/abc-defg-hij" />
        <span className="hint">In Google Meet, tap “New meeting → Create a meeting for later” and paste the link here.</span>
      </label>
    </Frame>
  );
}

function IssueForm({ onClose }: { onClose: () => void }) {
  const s = useReady();
  const { f, on, err, setErr, busy, setBusy } = useForm({ text: '' });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.text.trim().length < 5) return setErr('Describe the issue.');
    setBusy(true);
    const ok = await s.run(s.sb.from('issues').insert({ member_id: s.uid, body: f.text.trim() }), 'Issue sent to your sponsor and upline', 'issues');
    setBusy(false); if (ok) onClose();
  };
  const sp = s.me.sponsor_id ? s.nameOf[s.me.sponsor_id] : null;
  return (
    <Frame title="Raise an issue" sub={`Sent to ${sp || 'the team'}${sp ? ' and everyone above them' : ''}.`} btn="Send" {...{ err, busy, onClose }} onSubmit={submit}>
      <Area label="What’s the issue?" value={f.text} onChange={on('text')} placeholder="e.g. My Upwork proposal credits ran out" autoFocus />
    </Frame>
  );
}

function ReplyForm({ onClose, issueId }: { onClose: () => void; issueId: string }) {
  const s = useReady();
  const is = s.data.issues.find(x => x.id === issueId);
  const { f, on, err, setErr, busy, setBusy } = useForm({ text: '', resolve: true as boolean });
  if (!is) return null;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.text.trim().length < 2) return setErr('Write a reply.');
    setBusy(true);
    const ok = await s.run(s.sb.from('issues').update({ reply: f.text.trim(), status: f.resolve ? 'Resolved' : 'Open' }).eq('id', is.id), 'Reply sent', 'issues');
    setBusy(false); if (ok) onClose();
  };
  return (
    <Frame title={`Reply to ${s.I[is.member_id]?.first || ''}`} sub={is.body} btn="Send reply" {...{ err, busy, onClose }} onSubmit={submit}>
      <Area label="Reply" value={f.text} onChange={on('text')} autoFocus />
      <label className="field">Status<span className="flex items-center gap-2" style={{ color: 'var(--ink)', fontWeight: 500 }}><input type="checkbox" checked={!!f.resolve} onChange={on('resolve')} />Mark as resolved</span></label>
    </Frame>
  );
}

function AchForm({ onClose, who }: { onClose: () => void; who?: string }) {
  const s = useReady();
  const opts = [{ v: s.uid, l: `${s.me.name} (me)` }, ...useTeamOptions()];
  const { f, on, err, setErr, busy, setBusy } = useForm({ who: who || s.uid, kind: 'New tool', title: '' });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.title.trim().length < 3) return setErr('Describe the achievement.');
    if (f.who !== s.uid && !s.T.desc(s.uid).includes(f.who)) return setErr('You can add achievements for yourself or your team.');
    setBusy(true);
    const ok = await s.run(s.sb.from('achievements').insert({ member_id: f.who, title: f.title.trim(), kind: f.kind, added_by: s.uid }), 'Achievement added · visible to the whole team', 'achievements');
    setBusy(false); if (ok) onClose();
  };
  return (
    <Frame title="Add achievement" sub="Step-ups are added automatically. Use this for new tools, wins and recognition." btn="Add" {...{ err, busy, onClose }} onSubmit={submit}>
      <Select label="For" value={f.who} onChange={on('who')} options={opts} />
      <Select label="Type" value={f.kind} onChange={on('kind')} options={['New tool', 'Recognition', 'Milestone', 'Other'].map(v => ({ v, l: v }))} />
      <Input label="Achievement" value={f.title} onChange={on('title')} placeholder="e.g. Got a new tool: MacBook Pro" autoFocus />
    </Frame>
  );
}
