'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useReady } from '@/components/Store';
import { useUI } from '@/components/Shell';
import { Badge, Metric, PageHead } from '@/components/ui';
import { fd, monthShort, sum, usd, weekStart, type Tone } from '@/lib/logic';
import type { Order } from '@/lib/types';

const tone = (st: string): Tone => st === 'Completed' ? 'ok' : st === 'Active' ? 'info' : 'bad';

export default function Orders() {
  const s = useReady();
  const ui = useUI();
  const router = useRouter();
  const q = useSearchParams();
  const { uid, T, I, data, today, m0, nameOf } = s;
  const hasTeam = T.desc(uid).length > 0;
  const tab = q.get('tab') === 'team' && hasTeam ? 'team' : 'mine';
  const range = q.get('range') === 'week' ? 'week' : 'month';
  const set = (k: string, v: string) => { const p = new URLSearchParams(q.toString()); p.set(k, v); router.replace('/orders?' + p.toString()); };

  const from = range === 'week' ? weekStart(today) : m0;
  const scope = tab === 'team' ? [uid, ...T.desc(uid)] : [uid];
  const list = data.orders.filter(o => scope.includes(o.member_id) && o.order_date >= from).sort((a, b) => b.order_date.localeCompare(a.order_date) || b.created_at.localeCompare(a.created_at));
  const live = list.filter(o => o.status !== 'Cancelled');
  const pe = (id: string) => s.pe(id, from);
  const label = range === 'week' ? 'week' : monthShort(today);
  const cards = [
    { label: `Personal earnings · ${label}`, value: usd(pe(uid)), sub: `${s.live.filter(o => o.member_id === uid && o.order_date >= from).length} orders` },
    { label: `Team earnings · ${label}`, value: usd(sum(I[uid].team, pe)), sub: hasTeam ? `${I[uid].team.length} people incl. you` : 'Same as personal until your team grows' },
    { label: 'Orders in view', value: String(live.length), sub: usd(sum(live, o => o.amount)) },
    { label: 'People who collected orders', value: String(new Set(live.map(o => o.member_id)).size), sub: tab === 'team' ? 'In your team' : 'You' },
    { label: 'Cancelled', value: String(list.length - live.length), sub: 'Not counted in earnings' }
  ];
  const setStatus = (o: Order, status: 'Completed' | 'Cancelled') =>
    s.run(s.sb.from('orders').update({ status }).eq('id', o.id), status === 'Cancelled' ? 'Order cancelled · removed from earnings' : 'Order completed', 'orders');
  const actions = (o: Order) => o.member_id === uid && o.status === 'Active' ? (
    <div className="flex justify-end gap-1.5">
      <button type="button" className="btn btn-s btn-sm" onClick={() => setStatus(o, 'Completed')}>Complete</button>
      <button type="button" className="btn btn-d btn-sm" onClick={() => setStatus(o, 'Cancelled')}>Cancel</button>
    </div>
  ) : null;
  const who = (id: string) => I[id]?.name || nameOf[id] || '—';
  const sponsor = (id: string) => { const sp = I[id]?.sponsor_id; return sp ? (nameOf[sp] || '').split(' ')[0] : '—'; };
  const deco = (o: Order) => o.status === 'Cancelled' ? 'line-through' : 'none';

  return (
    <>
      <PageHead title="Orders & Earnings" sub="Personal earnings = your orders. Team earnings = your orders plus everyone in your team."
        action={<button type="button" className="btn btn-p" onClick={() => ui.openModal({ kind: 'order' })}>Log an order</button>} />
      <div className="flex flex-wrap gap-2">
        {[['week', 'This week'], ['month', 'This month']].map(([id, l]) => <button key={id} type="button" className="chip" aria-pressed={range === id} onClick={() => set('range', id)}>{l}</button>)}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
        {cards.map(k => <Metric key={k.label} {...k} />)}
      </div>
      {hasTeam && (
        <div role="tablist" className="flex gap-0.5" style={{ borderBottom: '1px solid var(--line)' }}>
          {[['mine', 'My orders'], ['team', 'Team orders']].map(([id, l]) => <button key={id} role="tab" type="button" className="tab" aria-selected={tab === id} onClick={() => set('tab', id)}>{l}</button>)}
        </div>
      )}
      {ui.narrow ? (
        <div className="card overflow-hidden">
          {list.map(o => (
            <div key={o.id} className="flex flex-col gap-2" style={{ padding: 12, borderBottom: '1px solid var(--line)' }}>
              <div className="flex justify-between gap-2.5">
                <div className="flex min-w-0 flex-col"><span style={{ fontWeight: 600 }}>{o.project}</span><span className="muted" style={{ fontSize: 12 }}>{who(o.member_id)} · {o.platform} · {fd(o.order_date)}</span></div>
                <div className="flex flex-none flex-col items-end gap-0.5"><span style={{ fontWeight: 700, textDecoration: deco(o) }}>{usd(o.amount)}</span><Badge tone={tone(o.status)} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 5 }}>{o.status}</Badge></div>
              </div>
              {actions(o)}
            </div>
          ))}
          {!list.length && <div className="empty">No orders yet. Tap &quot;Log an order&quot; when you get one.</div>}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
            <thead><tr>{['Project', 'Member', 'Sponsor', 'Platform', 'Date'].map(h => <th key={h} className="th">{h}</th>)}<th className="th" style={{ textAlign: 'right' }}>Amount</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>
              {list.map(o => (
                <tr key={o.id}>
                  <td className="td" style={{ fontWeight: 600 }}>{o.project}</td>
                  <td className="td">{who(o.member_id)}</td>
                  <td className="td muted">{sponsor(o.member_id)}</td>
                  <td className="td">{o.platform}</td>
                  <td className="td muted">{fd(o.order_date)}</td>
                  <td className="td tnum" style={{ textAlign: 'right', fontWeight: 600, textDecoration: deco(o) }}>{usd(o.amount)}</td>
                  <td className="td"><Badge tone={tone(o.status)}>{o.status}</Badge></td>
                  <td className="td" style={{ padding: '8px 16px' }}>{actions(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <div className="empty">No orders in this period.</div>}
        </div>
      )}
    </>
  );
}
