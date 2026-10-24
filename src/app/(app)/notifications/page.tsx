'use client';
import { useRouter } from 'next/navigation';
import { useReady } from '@/components/Store';
import { PAGES, pagePath } from '@/components/Shell';
import { PageHead } from '@/components/ui';
import { whenLabel } from '@/lib/logic';
import type { Notification } from '@/lib/types';

export default function Notifications() {
  const s = useReady();
  const router = useRouter();
  const { data, today, uid, T } = s;
  const known = PAGES(!s.me.sponsor_id, T.desc(uid).length > 0).map(p => p[0]);
  const unread = data.notifs.filter(n => !n.read).length;
  const open = async (n: Notification) => {
    if (!n.read) await s.run(s.sb.from('notifications').update({ read: true }).eq('id', n.id), undefined, 'notifs');
    router.push(pagePath(n.page, known));
  };
  const readAll = () => s.run(s.sb.from('notifications').update({ read: true }).eq('recipient_id', uid).eq('read', false), undefined, 'notifs');
  return (
    <>
      <PageHead title="Notifications" sub={`${unread} unread`} action={<button type="button" className="btn btn-s btn-md" onClick={readAll}>Mark all as read</button>} />
      <div className="card overflow-hidden">
        {data.notifs.map(n => (
          <div key={n.id} role="button" tabIndex={0} onClick={() => open(n)} onKeyDown={e => e.key === 'Enter' && open(n)} className="row-hover flex items-center gap-3"
            style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: n.read ? undefined : 'var(--acc-soft)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : 'var(--acc)', flex: 'none' }} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span style={{ fontWeight: n.read ? 500 : 600, wordBreak: 'break-word' }}>{n.body}</span>
              <span className="muted" style={{ fontSize: 12 }}>{whenLabel(n.created_at, today)} · {n.send_email ? 'In-app + email' : 'In-app'}</span>
            </div>
            {n.link && <a href={n.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12.5, fontWeight: 600 }}>Join</a>}
            <span style={{ fontSize: 12.5, color: 'var(--acc-text)', fontWeight: 600 }}>Open</span>
          </div>
        ))}
        {!data.notifs.length && <div className="empty">You&apos;re all caught up.</div>}
      </div>
    </>
  );
}
