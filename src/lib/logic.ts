// Business rules shared by every screen. Pure functions only, so they can be unit tested.
// The database is the source of truth for status (it never goes down); these mirror it for display.

export const RANKS = ['Member', 'Distributor', 'Manager', 'Senior Manager', 'Executive Manager', 'Director', 'Emerald Director'];
export const TH = [0, 100, 500, 1000, 2000, 4000, Infinity];
export const rankOf = (q: number) => TH.reduce((r, t, i) => (q >= t ? i : r), 0);
export const PLATFORMS = ['Fiverr', 'Upwork', 'Direct client', 'Other'] as const;

// Status badge colours (bg, ink) per rank.
export const RT: [string, string][] = [
  ['var(--neu-bg)', 'var(--neu)'], ['var(--info-bg)', 'var(--info)'], ['var(--acc-soft)', 'var(--acc-text)'],
  ['var(--ok-bg)', 'var(--ok)'], ['var(--warn-bg)', 'var(--warn)'], ['var(--ink)', 'var(--bg)'], ['var(--ok)', 'var(--panel)']
];
export const TONE = {
  ok: ['var(--ok-bg)', 'var(--ok)'], warn: ['var(--warn-bg)', 'var(--warn)'], bad: ['var(--bad-bg)', 'var(--bad)'],
  info: ['var(--info-bg)', 'var(--info)'], neu: ['var(--neu-bg)', 'var(--neu)'], acc: ['var(--acc-soft)', 'var(--acc-text)']
} as const;
export type Tone = keyof typeof TONE;

// ── Dates (Africa/Lagos, as YYYY-MM-DD strings) ──
const TZ = 'Africa/Lagos';
export const lagosDate = (d: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
export const lagosToday = () => lagosDate();
export const monthStart = (today: string) => today.slice(0, 8) + '01';
export const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const weekStart = (today: string) => {
  const dow = new Date(today + 'T12:00:00Z').getUTCDay(); // 0 Sun … 6 Sat
  return addDays(today, -((dow + 6) % 7));
};
export const nextMonthStart = (today: string) => {
  const [y, m] = today.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
};
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 864e5);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
export const fd = (d: string) => fmt(d, { day: 'numeric', month: 'short' });
export const fdw = (d: string) => fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
export const fdLong = (d: string) => fmt(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const monthName = (d: string) => fmt(d, { month: 'long' });
export const monthShort = (d: string) => fmt(d, { month: 'short' });
export const clock = (iso?: string | null) =>
  new Date(iso || Date.now()).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const lagosDateOf = (iso: string) => lagosDate(new Date(iso));
export const whenLabel = (iso: string, today: string) => {
  const d = lagosDateOf(iso);
  if (d === today) return clock(iso);
  if (d === addDays(today, -1)) return 'Yesterday ' + clock(iso);
  return fd(d);
};
export const greeting = () => {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// ── Money ──
export const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
export const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((t, x) => t + f(x), 0);

// ── Team tree ──
export type Node = { id: string; sponsor_id: string | null };
export function tree<T extends Node>(members: T[]) {
  const M: Record<string, T> = {};
  const kids: Record<string, string[]> = {};
  members.forEach(m => { M[m.id] = m; });
  members.forEach(m => { if (m.sponsor_id && M[m.sponsor_id]) (kids[m.sponsor_id] ||= []).push(m.id); });
  const desc = (id: string) => {
    const out: string[] = [];
    const seen = new Set<string>([id]);
    const walk = (x: string) => (kids[x] || []).forEach(k => { if (!seen.has(k)) { seen.add(k); out.push(k); walk(k); } });
    walk(id);
    return out;
  };
  const ups = (id: string) => {
    const out: string[] = [];
    let c = M[id]?.sponsor_id;
    while (c && M[c] && c !== id && !out.includes(c)) { out.push(c); c = M[c].sponsor_id; }
    return out;
  };
  return { M, kids, desc, ups };
}

export const activityOf = (lastActive: string, today: string) => {
  const d = daysBetween(lagosDateOf(lastActive), today);
  return d >= 14 ? 'Inactive' : d >= 7 ? 'Idle' : 'Active';
};

export const HUE = [290, 30, 150, 230, 350, 80, 190, 260, 120, 10, 210, 60, 320, 170, 100];
export const avatarOf = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = HUE[h % HUE.length];
  return { tint: `oklch(0.9 0.05 ${hue})`, ink: `oklch(0.4 0.12 ${hue})` };
};
export const initialsOf = (name: string) => name.trim().split(/\s+/).map(x => x[0] || '').join('').slice(0, 2).toUpperCase();
export const firstOf = (name: string) => name.trim().split(/\s+/)[0] || name;

export const dmId = (a: string, b: string) => 'dm:' + [a, b].sort().join('|');
export const MEET_RE = /^https:\/\/meet\.google\.com\/\S+/;

// ── Sponsor search (sign-up) ──
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Names containing every typed word (any order, any part). If none, the closest names as suggestions. */
export function matchNames<T extends { name: string }>(list: T[], query: string) {
  const q = norm(query);
  if (!q) return { matches: list, suggestions: [] as T[] };
  const words = q.split(' ');
  const matches = list.filter(p => { const n = norm(p.name); return words.every(w => n.includes(w)); });
  if (matches.length) return { matches, suggestions: [] as T[] };
  // Typo tolerance: compare each typed word with each part of the name (and the start of it).
  const score = (p: T) => {
    const parts = norm(p.name).split(' ');
    return words.reduce((t, w) => t + Math.min(...parts.map(x => Math.min(editDistance(w, x), editDistance(w, x.slice(0, w.length))))), 0);
  };
  const limit = Math.max(2, Math.ceil(q.replace(/ /g, '').length / 3));
  const suggestions = list.map(p => ({ p, s: score(p) })).filter(x => x.s <= limit).sort((a, b) => a.s - b.s).slice(0, 3).map(x => x.p);
  return { matches: [] as T[], suggestions };
}
