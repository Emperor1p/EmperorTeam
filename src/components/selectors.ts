'use client';
import { useMemo } from 'react';
import { useReady } from './Store';

/** Conversations, unread counts and nav badges, shared by the shell and the chat page. */
export function useChat() {
  const s = useReady();
  return useMemo(() => {
    const { uid, T, data } = s;
    const myDesc = T.desc(uid);
    const convMembers = (c: string) => c.startsWith('team:') ? [c.slice(5), ...T.desc(c.slice(5))] : c.slice(3).split('|');
    const readAt: Record<string, string> = {};
    data.reads.forEach(r => { readAt[r.conversation] = r.last_read_at; });
    const msgsOf = (c: string) => data.messages.filter(m => m.conversation === c);
    const unreadOf = (c: string) => msgsOf(c).filter(m => m.sender_id !== uid && (!readAt[c] || m.created_at > readAt[c])).length;
    const teamConvs = [...(myDesc.length ? ['team:' + uid] : []), ...T.ups(uid).map(u => 'team:' + u)];
    const dmConvs = [...new Set(data.messages.filter(m => m.conversation.startsWith('dm:') && m.conversation.includes(uid)).map(m => m.conversation))];
    const lastTs = (c: string) => { const l = msgsOf(c); return l.length ? l[l.length - 1].created_at : ''; };
    const all = [...teamConvs, ...dmConvs].sort((a, b) => lastTs(b).localeCompare(lastTs(a)));
    const total = all.reduce((t, c) => t + unreadOf(c), 0);
    return { convMembers, msgsOf, unreadOf, all, total, teamConvs, dmConvs };
  }, [s]);
}

export function useCounts(chatSel?: string | null) {
  const s = useReady();
  const chat = useChat();
  return useMemo(() => {
    const { uid, T, data, today } = s;
    const myDesc = T.desc(uid);
    const unread = data.notifs.filter(n => !n.read).length;
    const myLog = data.logs.find(l => l.member_id === uid && l.log_date === today);
    const myTodos = data.todos.filter(t => t.member_id === uid && t.todo_date === today);
    const visIssues = data.issues.filter(i => i.member_id === uid || T.ups(i.member_id).includes(uid));
    const openFromTeam = visIssues.filter(i => i.status === 'Open' && i.member_id !== uid).length;
    const tasksOpen = data.tasks.filter(t => t.assignee_id === uid && !t.done).length;
    const chatUnread = chat.total - (chatSel ? chat.unreadOf(chatSel) : 0);
    return {
      notifications: unread, chat: chatUnread, day: (myLog ? 0 : 1) + (myTodos.length ? 0 : 1), tasks: tasksOpen,
      issues: myDesc.length ? openFromTeam : 0
    } as Record<string, number>;
  }, [s, chat, chatSel]);
}
