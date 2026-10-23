'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Achievement, Book, ConvRead, DailyLog, Issue, Meeting, Message, NameRow, Notification, Order, Profile, QpvEntry, Task, Todo } from '@/lib/types';
import { RANKS, RT, activityOf, addDays, avatarOf, firstOf, initialsOf, lagosToday, monthStart, rankOf, sum, tree, weekStart } from '@/lib/logic';

type Data = {
  profiles: Profile[]; names: NameRow[]; qpv: QpvEntry[]; orders: Order[]; logs: DailyLog[]; books: Book[]; todos: Todo[];
  tasks: Task[]; meetings: Meeting[]; issues: Issue[]; achievements: Achievement[]; messages: Message[]; reads: ConvRead[]; notifs: Notification[];
};
const EMPTY: Data = { profiles: [], names: [], qpv: [], orders: [], logs: [], books: [], todos: [], tasks: [], meetings: [], issues: [], achievements: [], messages: [], reads: [], notifs: [] };
type Key = keyof Data;

export type Person = Profile & {
  first: string; initials: string; tint: string; ink: string; rLabel: string; rBg: string; rInk: string;
  q: number; teamQ: number; mr: number; team: string[]; personal: number; teamEarn: number; ordN: number;
  activity: 'Active' | 'Idle' | 'Inactive'; sponsorName: string;
};

const TABLE: Record<Exclude<Key, 'names'>, string> = {
  profiles: 'profiles', qpv: 'qpv_entries', orders: 'orders', logs: 'daily_logs', books: 'books', todos: 'todos', tasks: 'tasks',
  meetings: 'meetings', issues: 'issues', achievements: 'achievements', messages: 'messages', reads: 'conversation_reads', notifs: 'notifications'
};
const BY_TABLE: Record<string, Key> = Object.fromEntries(Object.entries(TABLE).map(([k, t]) => [t, k as Key]));

function useStoreValue() {
  const router = useRouter();
  const sb = supabase();
  const [uid, setUid] = useState<string | null>(null);
  const [data, setData] = useState<Data>(EMPTY);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(lagosToday());
  const [toast, setToast] = useState('');
  const [alert, setAlert] = useState<Notification | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const alertT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const say = useCallback((t: string) => {
    clearTimeout(toastT.current); setToast(t); toastT.current = setTimeout(() => setToast(''), 3000);
  }, []);

  const fetchKey = useCallback(async (k: Key, me: string) => {
    const t = lagosToday(), m0 = monthStart(t), from = [m0, weekStart(t)].sort()[0];
    let q;
    switch (k) {
      case 'names': q = sb.rpc('member_names'); break;
      case 'profiles': q = sb.from('profiles').select('*').eq('onboarded', true); break;
      case 'qpv': q = sb.from('qpv_entries').select('id,member_id,entry_date,amount').gte('entry_date', m0); break;
      case 'orders': q = sb.from('orders').select('*').gte('order_date', from).order('order_date', { ascending: false }); break;
      case 'logs': q = sb.from('daily_logs').select('*').gte('log_date', addDays(t, -6)); break;
      case 'books': q = sb.from('books').select('*').eq('month', m0); break;
      case 'todos': q = sb.from('todos').select('*').gte('todo_date', addDays(t, -60)).order('todo_date'); break;
      case 'tasks': q = sb.from('tasks').select('*').order('created_at', { ascending: false }).limit(500); break;
      case 'meetings': q = sb.from('meetings').select('*').gte('starts_at', addDays(t, -1) + 'T00:00:00Z').order('starts_at'); break;
      case 'issues': q = sb.from('issues').select('*').order('created_at', { ascending: false }).limit(300); break;
      case 'achievements': q = sb.from('achievements').select('*').order('created_at', { ascending: false }).limit(200); break;
      case 'messages': q = sb.from('messages').select('*').order('created_at', { ascending: false }).limit(1000); break;
      case 'reads': q = sb.from('conversation_reads').select('*').eq('member_id', me); break;
      case 'notifs': q = sb.from('notifications').select('*').eq('recipient_id', me).order('created_at', { ascending: false }).limit(100); break;
    }
    const { data: rows, error } = await q;
    if (error) { console.error(k, error.message); return; }
    let list = (rows || []) as never[];
    if (k === 'messages') list = list.slice().reverse();
    if (k === 'orders' || k === 'qpv') list = list.map((r: Record<string, unknown>) => ({ ...r, amount: Number(r.amount) })) as never[];
    setData(d => ({ ...d, [k]: list }));
  }, [sb]);

  const refresh = useCallback((...keys: Key[]) => {
    if (!uid) return Promise.resolve();
    return Promise.all(keys.map(k => fetchKey(k, uid))).then(() => undefined);
  }, [uid, fetchKey]);

  // Sign-in, first load and realtime subscription
  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof sb.channel> | null = null;
    let onWake: (() => void) | null = null;
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: me } = await sb.from('profiles').select('onboarded').eq('id', user.id).maybeSingle();
      if (!me || !me.onboarded) { router.replace('/onboarding'); return; }
      if (!alive) return;
      setUid(user.id);
      sb.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', user.id).then(() => {});
      await Promise.all((Object.keys(EMPTY) as Key[]).map(k => fetchKey(k, user.id)));
      if (!alive) return;
      setReady(true);
      // Attach the signed-in token before joining, so row-level security applies to live events.
      const { data: { session } } = await sb.auth.getSession();
      if (session) sb.realtime.setAuth(session.access_token);
      channel = sb.channel('emperor-live');
      Object.values(TABLE).forEach(table => {
        channel!.on('postgres_changes' as never, { event: '*', schema: 'public', table } as never, (p: { eventType: string; new: Notification }) => {
          const k = BY_TABLE[table];
          if (k === 'notifs' && p.eventType === 'INSERT' && p.new.recipient_id === user.id) {
            clearTimeout(alertT.current); setAlert(p.new); alertT.current = setTimeout(() => setAlert(null), 6000);
          }
          clearTimeout(timers.current[k]);
          timers.current[k] = setTimeout(() => {
            fetchKey(k, user.id);
            if (k === 'profiles') fetchKey('names', user.id);
          }, 250);
        });
      });
      // Anything that changed while (re)connecting is fetched once the channel is live.
      const reloadAll = () => (Object.keys(EMPTY) as Key[]).forEach(k => fetchKey(k, user.id));
      // Supabase sends this system message once database changes are actually streaming.
      channel.on('system' as never, {} as never, (m: { extension?: string; status?: string }) => { if (m.extension === 'postgres_changes' && m.status === 'ok') reloadAll(); });
      channel.subscribe();
      onWake = () => { if (document.visibilityState === 'visible') { reloadAll(); setToday(lagosToday()); } };
      document.addEventListener('visibilitychange', onWake);
    })();
    const tick = setInterval(() => setToday(lagosToday()), 60_000);
    const { data: sub } = sb.auth.onAuthStateChange((ev: string) => { if (ev === 'SIGNED_OUT') router.replace('/login'); });
    return () => { alive = false; clearInterval(tick); if (onWake) document.removeEventListener('visibilitychange', onWake); sub.subscription.unsubscribe(); if (channel) sb.removeChannel(channel); };
  }, [sb, router, fetchKey]);

  // Refetch date-windowed tables when the Lagos date changes (and QPV resets on the 1st)
  const lastDay = useRef(today);
  useEffect(() => {
    if (lastDay.current !== today) { lastDay.current = today; refresh('qpv', 'orders', 'logs', 'books', 'todos', 'meetings'); }
  }, [today, refresh]);

  const derived = useMemo(() => {
    const m0 = monthStart(today);
    const T = tree(data.profiles);
    const nameOf: Record<string, string> = {};
    data.names.forEach(n => { nameOf[n.id] = n.name; });
    data.profiles.forEach(p => { nameOf[p.id] = p.name; });
    const qBy: Record<string, number> = {};
    data.qpv.forEach(e => { if (e.entry_date >= m0) qBy[e.member_id] = (qBy[e.member_id] || 0) + e.amount; });
    const live = data.orders.filter(o => o.status !== 'Cancelled');
    const pe = (id: string, from = m0) => sum(live.filter(o => o.member_id === id && o.order_date >= from), o => o.amount);
    const ordN = (id: string) => live.filter(o => o.member_id === id && o.order_date >= m0).length;
    const I: Record<string, Person> = {};
    data.profiles.forEach(p => {
      const team = [p.id, ...T.desc(p.id)], q = qBy[p.id] || 0, teamQ = sum(team, x => qBy[x] || 0);
      I[p.id] = {
        ...p, first: firstOf(p.name), initials: initialsOf(p.name), ...avatarOf(p.id),
        rLabel: RANKS[p.status_rank], rBg: RT[p.status_rank][0], rInk: RT[p.status_rank][1],
        q, teamQ, mr: rankOf(teamQ), team, personal: pe(p.id), teamEarn: sum(team, x => pe(x)), ordN: ordN(p.id),
        activity: activityOf(p.last_active_at, today) as Person['activity'],
        sponsorName: p.sponsor_id ? (nameOf[p.sponsor_id] || '—') : 'None (top leader)'
      };
    });
    return { T, I, nameOf, live, pe, m0 };
  }, [data, today]);

  const me = uid ? derived.I[uid] : undefined;

  /** Run a Supabase call, show its error as a toast, then refetch the given tables. */
  const run = useCallback(async (p: PromiseLike<{ error: { message: string } | null }>, ok?: string, ...keys: Key[]) => {
    const { error } = await p;
    if (error) { say(cleanError(error.message)); return false; }
    if (ok) say(ok);
    if (keys.length) await refresh(...keys);
    return true;
  }, [say, refresh]);

  const dismissAlert = useCallback(() => setAlert(null), []);

  return { sb, uid, me, ready, today, data, ...derived, refresh, run, say, toast, alert, dismissAlert };
}

const cleanError = (m: string) => m.replace(/^.*?ERROR:\s*/, '').replace(/\s*\(SQLSTATE.*$/, '') || 'Something went wrong. Please try again.';

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const v = useStoreValue();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
/** For screens that render only once data is loaded. */
export function useReady() {
  const s = useStore();
  return s as Store & { me: Person; uid: string };
}
