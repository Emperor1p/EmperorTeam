'use client';
import { useReady } from '@/components/Store';
import { useUI } from '@/components/Shell';
import { Avatar, Badge, PageHead } from '@/components/ui';
import { dmId, fd, lagosDateOf } from '@/lib/logic';

export default function Issues() {
  const s = useReady();
  const ui = useUI();
  const { uid, T, I, data, nameOf } = s;
  const vis = data.issues.filter(i => i.member_id === uid || T.ups(i.member_id).includes(uid));
  return (
    <>
      <PageHead title="Issues" sub="An issue is visible to the person, their sponsor and everyone above them up to the top leader."
        action={<button type="button" className="btn btn-p" onClick={() => ui.openModal({ kind: 'issue' })}>Raise an issue</button>} />
      <div className="card overflow-hidden">
        {vis.map(i => {
          const p = I[i.member_id];
          if (!p) return null;
          const mine = i.member_id === uid;
          return (
            <div key={i.id} className="flex flex-wrap items-start gap-3" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
              <Avatar p={p} size={32} font={11} />
              <div className="flex min-w-0 flex-col gap-0.5" style={{ flex: '1 1 260px' }}>
                <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{i.body}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{mine ? 'You' : p.name} · sponsor {p.sponsor_id ? (nameOf[p.sponsor_id] || '').split(' ')[0] : '—'} · {fd(lagosDateOf(i.created_at))}</span>
                {i.reply && <span style={{ fontSize: 13, background: 'var(--sunk)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>{i.replied_by ? (nameOf[i.replied_by] || '').split(' ')[0] : 'Upline'}: {i.reply}</span>}
              </div>
              <Badge tone={i.status === 'Open' ? 'warn' : 'ok'}>{i.status}</Badge>
              {!mine && <button type="button" className="btn btn-s btn-sm" onClick={() => ui.openConv(dmId(uid, i.member_id))}>Chat</button>}
              {!mine && i.status === 'Open' && <button type="button" className="btn btn-s btn-sm" onClick={() => ui.openModal({ kind: 'reply', issueId: i.id })}>Reply</button>}
            </div>
          );
        })}
        {!vis.length && <div className="empty">No issues.</div>}
      </div>
    </>
  );
}
