'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useReady } from '@/components/Store';
import { useUI } from '@/components/Shell';
import { useChat } from '@/components/selectors';
import { Avatar } from '@/components/ui';
import { dmId, whenLabel, clock } from '@/lib/logic';

export default function Chat() {
  const s = useReady();
  const ui = useUI();
  const chat = useChat();
  const { uid, I, T, today, nameOf } = s;
  const narrow = ui.narrow;
  const sel = ui.chatSel;
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const msgs = sel ? chat.msgsOf(sel) : [];

  const canOpen = (c: string) => chat.convMembers(c).includes(uid);
  const convs = sel && sel.startsWith('dm:') && canOpen(sel) && !chat.all.includes(sel) ? [sel, ...chat.all] : chat.all;
  const isTeam = (c: string) => c.startsWith('team:');
  const title = (c: string) => isTeam(c) ? (c.slice(5) === uid ? 'My team' : `${(nameOf[c.slice(5)] || '').split(' ')[0]}’s team`) : (nameOf[chat.convMembers(c).find(x => x !== uid) || uid] || 'Chat');
  const nm = (id: string) => nameOf[id] || 'Someone';

  // Mark the open conversation read whenever new messages arrive in it
  const lastMsg = msgs.length ? msgs[msgs.length - 1].id : '';
  useEffect(() => {
    if (!sel) return;
    s.sb.from('conversation_reads').upsert({ member_id: uid, conversation: sel, last_read_at: new Date().toISOString() }).then(() => s.refresh('reads'));
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [sel, lastMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim(); if (!t || !sel) return;
    setText('');
    const ok = await s.run(s.sb.from('messages').insert({ conversation: sel, sender_id: uid, body: t.slice(0, 4000) }), undefined, 'messages');
    if (!ok) setText(t);
  };

  const contacts = [
    ...T.ups(uid).map(id => ({ v: id, l: `${nm(id)} · ${id === s.me.sponsor_id ? 'your sponsor' : 'upline'}` })),
    ...T.desc(uid).map(id => ({ v: id, l: `${I[id].name} · ${I[id].sponsor_id === uid ? 'direct leg' : 'in your team'}` }))
  ];
  const showList = !narrow || !sel, showThread = !!sel || !narrow;

  return (
    <div className="card flex overflow-hidden" style={{ height: narrow ? 'calc(100vh - 180px)' : 'calc(100vh - 150px)', minHeight: 420 }}>
      {showList && (
        <div className="flex min-w-0 flex-col" style={{ width: narrow ? '100%' : 320, flex: 'none', borderRight: '1px solid var(--line)' }}>
          <div className="flex flex-col gap-2.5" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Chat</span>
            <select className="input" value="" onChange={e => e.target.value && ui.setChatSel(dmId(uid, e.target.value))} aria-label="New message" style={{ fontWeight: 600, fontSize: 13 }}>
              <option value="">New message to…</option>
              {contacts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convs.map(c => {
              const l = chat.msgsOf(c), last = l[l.length - 1], u = c === sel ? 0 : chat.unreadOf(c);
              const other = isTeam(c) ? null : (chat.convMembers(c).find(x => x !== uid) || uid);
              const av = other && I[other] ? I[other] : other ? { initials: (nm(other)[0] || '?').toUpperCase(), tint: 'var(--sunk)', ink: 'var(--ink)', avatar_url: s.photoOf[other] } : { initials: '#', tint: 'var(--acc-soft)', ink: 'var(--acc-text)' };
              return (
                <div key={c} role="button" tabIndex={0} onClick={() => ui.setChatSel(c)} onKeyDown={e => e.key === 'Enter' && ui.setChatSel(c)} className="row-hover flex items-center gap-2.5"
                  style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: c === sel ? 'var(--acc-soft)' : undefined }}>
                  <Avatar p={av} size={38} font={13} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex justify-between gap-1.5"><span style={{ fontWeight: u ? 700 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title(c)}</span><span className="muted" style={{ fontSize: 11.5, flex: 'none' }}>{last ? whenLabel(last.created_at, today) : ''}</span></div>
                    <span className="muted" style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {last ? `${last.sender_id === uid ? 'You' : nm(last.sender_id).split(' ')[0]}: ${last.body}` : isTeam(c) ? `${chat.convMembers(c).length} members · group chat` : 'No messages yet'}
                    </span>
                  </div>
                  {u ? <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: 'var(--acc)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flex: 'none' }}>{u}</span> : null}
                </div>
              );
            })}
            {!convs.length && <div className="muted" style={{ padding: '24px 16px', fontSize: 13 }}>No chats yet. Pick someone above to start one.</div>}
          </div>
        </div>
      )}
      {showThread && (
        <div className="flex min-w-0 flex-1 flex-col">
          {sel && canOpen(sel) ? <>
            <div className="flex items-center gap-2.5" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
              {narrow && <button type="button" onClick={() => ui.setChatSel(null)} aria-label="Back" className="btn btn-s" style={{ width: 34, height: 34, padding: 0, borderRadius: 8, fontWeight: 700 }}>‹</button>}
              <div className="flex min-w-0 flex-col"><span style={{ fontWeight: 700 }}>{title(sel)}</span><span className="muted" style={{ fontSize: 12 }}>{isTeam(sel) ? `${chat.convMembers(sel).length} members · everyone in this team can read` : 'Private conversation'}</span></div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto" style={{ padding: 16 }}>
              {msgs.map((m, i) => {
                const mine = m.sender_id === uid, showName = !mine && (i === 0 || msgs[i - 1].sender_id !== m.sender_id);
                return (
                  <div key={m.id} className="flex flex-col gap-0.5" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                    {showName && <span style={{ fontSize: 11.5, fontWeight: 700, padding: '0 4px', marginTop: 6 }} className="muted">{nm(m.sender_id)}</span>}
                    <div className="flex flex-col gap-0.5" style={{ maxWidth: 'min(78%,520px)', background: mine ? 'var(--acc)' : 'var(--sunk)', color: mine ? '#fff' : 'var(--ink)', borderRadius: 14, padding: '8px 12px' }}>
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</span>
                      <span style={{ fontSize: 10.5, opacity: .7, alignSelf: 'flex-end' }}>{clock(m.created_at)}</span>
                    </div>
                  </div>
                );
              })}
              {!msgs.length && <span className="muted" style={{ margin: 'auto', fontSize: 13 }}>No messages yet. Say hello.</span>}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="flex gap-2" style={{ padding: 10, borderTop: '1px solid var(--line)' }}>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Write a message" aria-label="Message" maxLength={4000}
                style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 21, border: '1px solid var(--line2)', background: 'var(--sunk)', padding: '0 16px' }} />
              <button type="submit" className="btn btn-p" style={{ height: 42, padding: '0 18px', borderRadius: 21 }}>Send</button>
            </form>
          </> : (
            <div className="muted flex flex-col gap-1" style={{ margin: 'auto', textAlign: 'center', padding: 24 }}>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Choose a chat</span>
              <span style={{ fontSize: 13 }}>Team group chats and private messages with your sponsor, upline and downline.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
