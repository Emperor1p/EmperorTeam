'use client';
import { useReady } from '@/components/Store';
import { useUI } from '@/components/Shell';
import { Avatar, Badge, PageHead } from '@/components/ui';
import { avatarOf, fd, initialsOf, lagosDateOf, type Tone } from '@/lib/logic';

const tone = (k: string): Tone => k === 'Step up' ? 'acc' : k === 'New tool' ? 'info' : k === 'Recognition' ? 'warn' : 'neu';

export default function Achievements() {
  const s = useReady();
  const ui = useUI();
  const { data, nameOf, photoOf } = s;
  return (
    <>
      <PageHead title="Achievements" sub="Step-ups are added automatically. Leaders can add achievements for their team, and they show for everyone."
        action={<button type="button" className="btn btn-p" onClick={() => ui.openModal({ kind: 'ach' })}>Add achievement</button>} />
      <div className="card overflow-hidden">
        {data.achievements.map(a => {
          const name = nameOf[a.member_id] || 'Team member';
          return (
            <div key={a.id} className="flex flex-wrap items-center gap-3" style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)' }}>
              <Avatar p={{ initials: initialsOf(name), ...avatarOf(a.member_id), avatar_url: photoOf[a.member_id] }} size={34} font={11} />
              <div className="flex min-w-0 flex-col" style={{ flex: '1 1 220px' }}>
                <span style={{ fontWeight: 600 }}>{a.title}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{name} · {fd(lagosDateOf(a.created_at))} · {a.added_by ? `Added by ${(nameOf[a.added_by] || '—').split(' ')[0]}` : 'Added automatically'}</span>
              </div>
              <Badge tone={tone(a.kind)} style={{ fontSize: 11.5, fontWeight: 700 }}>{a.kind}</Badge>
            </div>
          );
        })}
        {!data.achievements.length && <div className="empty">No achievements yet. Step-ups appear here automatically.</div>}
      </div>
    </>
  );
}
