'use client';
import type { CSSProperties, ReactNode } from 'react';
import { RT, TONE, type Tone } from '@/lib/logic';

export function Avatar({ p, size = 32, font }: { p: { initials: string; tint: string; ink: string }; size?: number; font?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', background: p.tint, color: p.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: font ?? Math.round(size * 0.36), flex: 'none' }}>
      {p.initials}
    </span>
  );
}

export function RankBadge({ rank, small }: { rank: number; small?: boolean }) {
  const [bg, ink] = RT[rank];
  return <span className="badge" style={{ background: bg, color: ink, fontWeight: 700, ...(small ? { fontSize: 11.5, padding: '2px 7px', borderRadius: 5 } : {}) }}>{['Member', 'Distributor', 'Manager', 'Senior Manager', 'Executive Manager', 'Director', 'Emerald Director'][rank]}</span>;
}

export function Badge({ tone, children, style }: { tone: Tone; children: ReactNode; style?: CSSProperties }) {
  return <span className="badge" style={{ background: TONE[tone][0], color: TONE[tone][1], ...style }}>{children}</span>;
}

export function PageHead({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1"><h1 className="h1">{title}</h1>{sub && <span className="muted">{sub}</span>}</div>
      {action}
    </div>
  );
}

export function Metric({ label, value, sub, onClick, ink }: { label: string; value: ReactNode; sub?: ReactNode; onClick?: () => void; ink?: string }) {
  const body = (<><span className="metric-label">{label}</span><span className="metric-value" style={ink ? { color: ink } : undefined}>{value}</span>{sub !== undefined && <span className="metric-sub">{sub}</span>}</>);
  return onClick ? <button type="button" className="metric" onClick={onClick}>{body}</button> : <div className="metric">{body}</div>;
}

export function Breakdown({ items, size = 32 }: { items: { label: string; count: number; rank: number }[]; size?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(b => (
        <span key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8, height: size, padding: '0 12px', borderRadius: size / 2, background: RT[b.rank][0], color: RT[b.rank][1], fontWeight: 600, fontSize: 12.5 }}>
          {b.label}<span style={{ fontWeight: 700, fontSize: size > 30 ? 14 : undefined }}>{b.count}</span>
        </span>
      ))}
    </div>
  );
}

export function Check({ done, onClick, size = 24, disabled }: { done: boolean; onClick?: () => void; size?: number; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={done ? 'Mark not done' : 'Mark done'} aria-pressed={done} disabled={disabled}
      style={{ width: size, height: size, borderRadius: 6, border: `1.5px solid ${done ? 'var(--acc)' : 'var(--line2)'}`, background: done ? 'var(--acc)' : 'transparent', color: '#fff', fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: 1 }}>
      {done ? '✓' : ''}
    </button>
  );
}

export function Skeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      <div className="skel" style={{ height: 56, maxWidth: 360 }} />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' }}>
        <div className="skel" style={{ height: 210 }} /><div className="skel" style={{ height: 210 }} /><div className="skel" style={{ height: 210 }} />
      </div>
      <div className="skel" style={{ height: 160 }} />
    </div>
  );
}
