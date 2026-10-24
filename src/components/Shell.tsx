'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore, type Store, type Person } from './Store';
import { useCounts } from './selectors';
import { Avatar, Skeleton } from './ui';
import { ProfileDrawer } from './ProfileDrawer';
import { ModalHost, type ModalReq } from './Modals';
import { APP_NAME } from '@/lib/config';

type UI = {
  openDetail: (id: string) => void;
  openModal: (m: ModalReq) => void;
  openConv: (c: string) => void;
  chatSel: string | null;
  setChatSel: (c: string | null) => void;
  narrow: boolean;
};
const UICtx = createContext<UI | null>(null);
export const useUI = () => { const v = useContext(UICtx); if (!v) throw new Error('useUI outside Shell'); return v; };

export const PAGES = (isRoot: boolean, hasTeam: boolean): [string, string][] => [
  ['dashboard', 'Dashboard'], ['day', 'My Day'], ['chat', 'Chat'], ['orders', 'Orders & Earnings'], ['team', isRoot ? 'Organisation' : 'My Team'],
  ['tasks', 'Team Tasks'], ['meetings', 'Meetings'], ['issues', 'Issues'], ['achievements', 'Achievements'],
  ...(hasTeam ? [['activity', 'Activity'] as [string, string]] : []), ['notifications', 'Notifications'], ['settings', 'Settings']
];
export const pagePath = (page: string, known: string[]) => '/' + (known.includes(page) ? page : 'notifications');

function useWidth() {
  // Frame only renders in the browser (after data loads), so the real width is known up front.
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => { const f = () => setW(window.innerWidth); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return w;
}

export function Shell({ children }: { children: ReactNode }) {
  const s = useStore();
  if (!s.ready || !s.me) {
    return <div style={{ padding: '28px 32px', maxWidth: 1240, margin: '0 auto' }}><Skeleton /></div>;
  }
  return <Frame s={s as Store & { me: Person; uid: string }}>{children}</Frame>;
}

function Frame({ s, children }: { s: Store & { me: Person; uid: string }; children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const w = useWidth();
  const wide = w >= 960, narrow = w < 640;
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalReq | null>(null);
  const [chatSel, setChatSel] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => { setTheme((document.documentElement.dataset.theme as 'light' | 'dark') || 'light'); }, []);
  useEffect(() => { setNavOpen(false); setDetail(null); }, [path]);

  const me = s.me, hasTeam = s.T.desc(s.uid).length > 0, isRoot = !me.sponsor_id;
  const pages = PAGES(isRoot, hasTeam);
  const current = path.split('/')[1] || 'dashboard';
  const counts = useCounts(current === 'chat' ? chatSel : null);
  const known = pages.map(p => p[0]);

  const openConv = useCallback((c: string) => {
    setChatSel(c); setDetail(null);
    router.push('/chat');
    s.sb.from('conversation_reads').upsert({ member_id: s.uid, conversation: c, last_read_at: new Date().toISOString() }).then(() => s.refresh('reads'));
  }, [router, s]);

  const toggleTheme = () => {
    const t = theme === 'dark' ? 'light' : 'dark';
    setTheme(t); document.documentElement.dataset.theme = t;
    try { localStorage.setItem('emperor-theme', t); } catch { /* ignore */ }
  };
  const signOut = async () => { await s.sb.auth.signOut(); router.replace('/login'); };
  const go = (id: string) => router.push('/' + id);
  const showLabels = !wide || !collapsed;
  const menuCount = (counts.notifications || 0) + (counts.tasks || 0) + (counts.issues || 0);
  const ui: UI = { openDetail: setDetail, openModal: setModal, openConv, chatSel, setChatSel, narrow };

  return (
    <UICtx.Provider value={ui}>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex' }}>
        {!wide && navOpen && <div onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 30 }} />}
        <aside style={{ position: wide ? 'sticky' : 'fixed', left: wide || navOpen ? 0 : -260, top: 0, height: '100vh', width: wide && collapsed ? 68 : 236, flex: 'none', background: 'var(--panel)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', zIndex: 40, transition: 'left .2s,width .2s' }}>
          <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--acc)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flex: 'none' }}>{APP_NAME[0]}</div>
            {showLabels && <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>{APP_NAME}</span>}
          </div>
          <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {pages.map(([id, label]) => {
              const on = current === id, n = counts[id];
              return (
                <a key={id} href={'/' + id} onClick={e => { e.preventDefault(); go(id); }} title={label} aria-current={on ? 'page' : undefined} className="row-hover"
                  style={{ height: 38, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10, padding: '0 9px', cursor: 'pointer', background: on ? 'var(--acc-soft)' : undefined, color: on ? 'var(--acc-text)' : 'var(--ink)', fontWeight: on ? 600 : 500, textDecoration: 'none' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, border: '1.5px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none', opacity: .85 }}>{label[0]}</span>
                  {showLabels && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>{label}</span>}
                  {showLabels && n ? <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: 'var(--acc)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{n}</span> : null}
                </a>
              );
            })}
          </nav>
          <div style={{ padding: 12, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar p={me} size={32} font={12} />
            {showLabels && <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.name}</span>
                <span style={{ fontSize: 12, color: 'var(--mut)' }}>{me.rLabel}</span>
              </div>
              <button type="button" onClick={signOut} style={{ height: 28, padding: '0 9px', borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Sign out</button>
            </>}
          </div>
        </aside>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <header style={{ height: 60, position: 'sticky', top: 0, zIndex: 20, background: 'var(--panel)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px' }}>
            <button type="button" onClick={() => wide ? setCollapsed(!collapsed) : setNavOpen(!navOpen)} aria-label="Toggle navigation" style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--panel)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 14, height: 1.5, background: 'var(--ink)' }} />)}
            </button>
            <span style={{ fontWeight: 600, fontSize: 15, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(pages.find(p => p[0] === current) || ['', ''])[1]}</span>
            <span title="Updates from your team appear instantly" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 26, padding: '0 9px', borderRadius: 13, background: 'var(--ok-bg)', color: 'var(--ok)', fontSize: 12, fontWeight: 700, flex: 'none' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', animation: 'tfpulse 1.6s infinite' }} />{!narrow && 'Live'}
            </span>
            <button type="button" onClick={toggleTheme} aria-label="Toggle dark mode" className="btn btn-s" style={{ padding: '0 10px', fontSize: 12.5, flex: 'none' }}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
            <button type="button" onClick={() => go('notifications')} aria-label="Notifications" style={{ position: 'relative', width: 36, height: 36, borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--panel)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <span style={{ width: 12, height: 12, borderRadius: '6px 6px 2px 2px', border: '1.5px solid var(--ink)' }} />
              {counts.notifications ? <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--bad)', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{counts.notifications}</span> : null}
            </button>
          </header>
          <main style={{ padding: narrow ? '16px 12px 96px' : '28px 32px 60px', width: '100%', maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {children}
          </main>
        </div>

        {detail && <ProfileDrawer id={detail} onClose={() => setDetail(null)} />}

        {narrow && (
          <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 68, background: 'var(--panel)', borderTop: '1px solid var(--line)', display: 'flex', zIndex: 25, padding: '6px 6px 8px' }}>
            {[['dashboard', 'Home'], ['day', 'My Day'], ['chat', 'Chat'], ['team', 'Team']].map(([id, label]) => {
              const on = current === id, n = counts[id];
              return (
                <button key={id} type="button" onClick={() => go(id)} aria-current={on ? 'page' : undefined} style={{ flex: 1, border: 'none', background: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', color: on ? 'var(--acc-text)' : 'var(--mut)', position: 'relative' }}>
                  <span style={{ width: 44, height: 28, borderRadius: 14, background: on ? 'var(--acc-soft)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{label[0]}</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
                  {n ? <Dot n={n} /> : null}
                </button>
              );
            })}
            <button type="button" onClick={() => setNavOpen(true)} style={{ flex: 1, border: 'none', background: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', color: 'var(--mut)', position: 'relative' }}>
              <span style={{ width: 44, height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 16, height: 1.5, background: 'currentColor' }} />)}</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>More</span>
              {menuCount ? <Dot n={menuCount} /> : null}
            </button>
          </nav>
        )}

        {modal && <ModalHost req={modal} onClose={() => setModal(null)} />}

        {s.alert && (
          <div role="alert" style={{ position: 'fixed', top: narrow ? 68 : 72, right: 12, zIndex: 85, width: 'min(380px, calc(100vw - 24px))', background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 12, boxShadow: '0 12px 36px rgba(0,0,0,.18)', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--acc)', marginTop: 6, flex: 'none' }} />
            <div onClick={() => { const a = s.alert!; s.dismissAlert(); s.sb.from('notifications').update({ read: true }).eq('id', a.id).then(() => s.refresh('notifs')); router.push(pagePath(a.page, known)); }} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc-text)' }}>New notification</span><span style={{ fontWeight: 600 }}>{s.alert.body}</span>
            </div>
            <button type="button" onClick={s.dismissAlert} aria-label="Dismiss" style={{ border: 'none', background: 'none', color: 'var(--mut)', cursor: 'pointer', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}
        {s.toast && (
          <div role="status" style={{ position: 'fixed', bottom: narrow ? 82 : 20, left: '50%', transform: 'translateX(-50%)', zIndex: 80, background: 'var(--ink)', color: 'var(--bg)', borderRadius: 10, padding: '11px 16px', fontWeight: 600, fontSize: 13.5, boxShadow: '0 10px 30px rgba(0,0,0,.2)', maxWidth: 'calc(100vw - 32px)' }}>{s.toast}</div>
        )}
      </div>
    </UICtx.Provider>
  );
}

const Dot = ({ n }: { n: number }) => (
  <span style={{ position: 'absolute', top: 0, left: 'calc(50% + 8px)', minWidth: 17, height: 17, borderRadius: 9, background: 'var(--bad)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{n}</span>
);
