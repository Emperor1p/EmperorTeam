'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RANKS, matchNames } from '@/lib/logic';
import { APP_NAME } from '@/lib/config';

export type SponsorHit = { id: string; name: string; status_rank: number };

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-7">
      <div className="flex w-full max-w-[430px] flex-col gap-4">
        <div className="flex items-center justify-center gap-2.5">
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--acc)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{APP_NAME[0]}</div>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em' }}>{APP_NAME}</span>
        </div>
        <div className="card flex flex-col gap-4" style={{ borderRadius: 16, padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

/** Sponsor field: a dropdown of every member. An invite link preselects the sponsor.
 *  Falls back to name search if the member list isn't available (004_sponsor_list.sql not run). */
export function SponsorPicker({ value, onChange, hasRoot }: { value: SponsorHit | null; onChange: (s: SponsorHit | null) => void; hasRoot: boolean | null }) {
  const [list, setList] = useState<SponsorHit[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (hasRoot === false) return;
    supabase().rpc('list_sponsors').then(({ data, error }: { data: SponsorHit[] | null; error: unknown }) => {
      if (error || !data) setFailed(true); else setList(data);
    });
  }, [hasRoot]);

  if (hasRoot === false) {
    return <div className="field">Sponsor (who brought you in)<span style={{ fontWeight: 400, color: 'var(--ink)', background: 'var(--sunk)', borderRadius: 9, padding: '10px 12px' }}>No sponsor · You will be the top leader</span></div>;
  }
  if (failed) return <SponsorSearch value={value} onChange={onChange} />;
  return <SponsorCombo list={list} value={value} onChange={onChange} />;
}

/** Type-to-filter dropdown: shows everyone, narrows as you type, suggests close names for typos. */
function SponsorCombo({ list, value, onChange }: { list: SponsorHit[] | null; value: SponsorHit | null; onChange: (s: SponsorHit | null) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const all = list || [];
  const { matches, suggestions } = matchNames(all, q);
  const shown = matches.length ? matches : suggestions;
  const pick = (h: SponsorHit) => { onChange(h); setQ(''); setOpen(false); };
  const label = (h: SponsorHit) => `${h.name} · ${RANKS[h.status_rank]}`;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); pick(shown[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };
  return (
    <div className="field">
      <label htmlFor="sponsor-box">Sponsor (who brought you in)</label>
      <div style={{ position: 'relative', display: 'flex' }}>
        <input id="sponsor-box" className="input" style={{ flex: 1, height: 40, paddingRight: 36 }} role="combobox" aria-expanded={open} aria-controls="sponsor-list" aria-autocomplete="list" autoComplete="off"
          disabled={!list} placeholder={!list ? 'Loading members…' : value ? '' : 'Tap to choose, or type a name'}
          value={open ? q : value ? label(value) : q}
          onFocus={() => { setOpen(true); setActive(0); }}
          onBlur={e => { if (!listRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false); }}
          onClick={() => setOpen(true)}
          onChange={e => { setQ(e.target.value); setOpen(true); setActive(0); if (value) onChange(null); }}
          onKeyDown={onKey} />
        <span aria-hidden style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', pointerEvents: 'none', fontSize: 11 }}>▾</span>
        {open && list && (
          <div ref={listRef} id="sponsor-list" role="listbox" className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20, maxHeight: 260, overflowY: 'auto', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,.12)' }}>
            {!matches.length && suggestions.length > 0 && <div className="muted" style={{ padding: '8px 12px 4px', fontSize: 12, fontWeight: 600 }}>No exact match. Did you mean:</div>}
            {shown.map((h, i) => (
              <div key={h.id} role="option" tabIndex={-1} aria-selected={i === active} onMouseDown={e => e.preventDefault()} onClick={() => pick(h)} onMouseEnter={() => setActive(i)}
                className="flex items-center justify-between gap-2" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', cursor: 'pointer', color: 'var(--ink)', fontWeight: 600, background: i === active ? 'var(--sunk)' : undefined }}>
                {h.name}<span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>{RANKS[h.status_rank]}</span>
              </div>
            ))}
            {!shown.length && <div className="muted" style={{ padding: '10px 12px', fontWeight: 400 }}>No one with that name. Check the spelling, or ask your sponsor for their invite link.</div>}
          </div>
        )}
      </div>
      <span className="hint">Tap to see everyone, or type part of a name. Your sponsor&apos;s invite link fills this in for you.</span>
    </div>
  );
}

function SponsorSearch({ value, onChange }: { value: SponsorHit | null; onChange: (s: SponsorHit | null) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SponsorHit[]>([]);
  useEffect(() => {
    if (q.trim().length < 3) { setHits([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase().rpc('find_sponsors', { q: q.trim() });
      setHits((data as SponsorHit[]) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  if (value) {
    return (
      <div className="field">Sponsor (who brought you in)
        <div className="flex items-center justify-between gap-2" style={{ background: 'var(--sunk)', borderRadius: 9, padding: '8px 8px 8px 12px', color: 'var(--ink)' }}>
          <span style={{ fontWeight: 600 }}>{value.name} <span className="muted" style={{ fontWeight: 400 }}>· {RANKS[value.status_rank]}</span></span>
          <button type="button" className="btn btn-s btn-sm" onClick={() => onChange(null)}>Change</button>
        </div>
      </div>
    );
  }
  return (
    <label className="field">Sponsor (who brought you in)
      <input className="input" style={{ height: 40 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Type your sponsor's name" autoComplete="off" />
      {q.trim().length >= 3 && (
        <div className="card" style={{ borderRadius: 10, overflow: 'hidden' }}>
          {hits.map(h => (
            <button type="button" key={h.id} onClick={() => { onChange(h); setQ(''); }} className="row row-hover flex w-full items-center justify-between gap-2 text-left"
              style={{ padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', color: 'var(--ink)', fontWeight: 600 }}>
              {h.name}<span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>{RANKS[h.status_rank]}</span>
            </button>
          ))}
          {hits.length === 0 && <span className="muted" style={{ display: 'block', padding: '9px 12px', fontWeight: 400 }}>No one found. Ask your sponsor for their invite link.</span>}
        </div>
      )}
    </label>
  );
}

export function StatusFields({ kind, setKind, qpv, setQpv, earn, setEarn }: { kind: string; setKind: (v: string) => void; qpv: string; setQpv: (v: string) => void; earn: string; setEarn: (v: string) => void }) {
  return (
    <>
      <label className="field">My current status
        <select className="input" style={{ height: 40 }} value={kind} onChange={e => setKind(e.target.value)}>{RANKS.map((r, i) => <option key={r} value={i}>{r}</option>)}</select>
        <span className="hint">Choose the status you already hold. It never goes down.</span>
      </label>
      <label className="field">QPV this month so far (optional)
        <input className="input" style={{ height: 40 }} type="number" min={0} step={1} value={qpv} onChange={e => setQpv(e.target.value)} placeholder="0" />
        <span className="hint">Adds to your sponsor line&apos;s QPV.</span>
      </label>
      <label className="field">Earnings this month before joining (USD, optional)
        <input className="input" style={{ height: 40 }} type="number" min={0} step="0.01" value={earn} onChange={e => setEarn(e.target.value)} placeholder="0" />
        <span className="hint">Adds to your sponsor&apos;s team earnings. QPV and earnings reset to 0 on the 1st of every month.</span>
      </label>
    </>
  );
}

/** Validates the optional numbers; returns an error message or null. */
export function checkStatusNumbers(qpv: string, earn: string) {
  if (qpv && !/^\d+$/.test(qpv)) return 'QPV must be a whole number, 0 or more.';
  if (earn && !(Number(earn) >= 0)) return 'Earnings can’t be negative.';
  return null;
}

/** Sign-in links from Supabase invite emails arrive as #access_token=…; turn them into a session. */
export async function consumeHashSession() {
  if (typeof window === 'undefined' || !location.hash.includes('access_token=')) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  const access_token = p.get('access_token'), refresh_token = p.get('refresh_token');
  history.replaceState(null, '', location.pathname + location.search);
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase().auth.setSession({ access_token, refresh_token });
  return !error;
}

export const PENDING_SPONSOR = 'emperor-pending-sponsor';
