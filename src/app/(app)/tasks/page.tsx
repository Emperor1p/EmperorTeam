'use client';
import { useState } from 'react';
import { useReady } from '@/components/Store';
import { useUI } from '@/components/Shell';
import { Badge, Check, PageHead } from '@/components/ui';
import { fd } from '@/lib/logic';
import type { Task } from '@/lib/types';

export default function Tasks() {
  const s = useReady();
  const ui = useUI();
  const { uid, T, data, today, nameOf, I } = s;
  const hasTeam = T.desc(uid).length > 0;
  const [tab, setTab] = useState<'mine' | 'given'>('mine');
  const mine = data.tasks.filter(t => t.assignee_id === uid), given = data.tasks.filter(t => t.assigned_by === uid);
  const list = (tab === 'given' && hasTeam ? given : mine).slice().sort((a, b) => Number(a.done) - Number(b.done) || a.due_date.localeCompare(b.due_date));
  const toggle = (t: Task) => s.run(s.sb.from('tasks').update({ done: !t.done }).eq('id', t.id), t.done ? undefined : 'Task completed · your leader has been notified', 'tasks');
  const nm = (id: string) => nameOf[id] || 'Someone';

  return (
    <>
      <PageHead title="Team Tasks" sub="Leaders can assign tasks to their direct legs or anyone deeper in their team."
        action={hasTeam ? <button type="button" className="btn btn-p" onClick={() => ui.openModal({ kind: 'task' })}>Assign task</button> : undefined} />
      <div role="tablist" className="flex gap-0.5" style={{ borderBottom: '1px solid var(--line)' }}>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>Assigned to me <span style={{ opacity: .7 }}>{mine.length}</span></button>
        {hasTeam && <button type="button" role="tab" className="tab" aria-selected={tab === 'given'} onClick={() => setTab('given')}>I assigned <span style={{ opacity: .7 }}>{given.length}</span></button>}
      </div>
      <div className="card overflow-hidden">
        {list.map(t => {
          const over = !t.done && t.due_date < today, st = t.done ? 'Done' : over ? 'Overdue' : 'Open';
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-3" style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)' }}>
              {t.assignee_id === uid && <Check size={22} done={t.done} onClick={() => toggle(t)} />}
              <div className="flex min-w-0 flex-col" style={{ flex: '1 1 220px' }}>
                <span style={{ fontWeight: 600, textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {tab === 'mine' ? `From ${nm(t.assigned_by)}` : `To ${nm(t.assignee_id)}${I[t.assignee_id]?.sponsor_id === uid ? ' (direct leg)' : ''}`} · <span style={{ color: over ? 'var(--bad)' : 'var(--mut)' }}>{t.due_date === today ? 'Due today' : `Due ${fd(t.due_date)}`}</span>
                </span>
              </div>
              <Badge tone={t.done ? 'ok' : over ? 'bad' : 'info'}>{st}</Badge>
            </div>
          );
        })}
        {!list.length && <div className="empty">Nothing here.</div>}
      </div>
    </>
  );
}
