export type Profile = {
  id: string; name: string; email: string; sponsor_id: string | null; status_rank: number;
  joined_at: string; last_active_at: string; onboarded: boolean; avatar_url: string | null; external_sponsor: string | null;
};
export type QpvEntry = { id: string; member_id: string; entry_date: string; amount: number };
export type OrderStatus = 'Active' | 'Completed' | 'Cancelled';
export type Order = { id: string; member_id: string; project: string; platform: string; amount: number; order_date: string; status: OrderStatus; created_at: string };
export type DailyLog = { member_id: string; log_date: string; fiverr_msgs: number; upwork_msgs: number; orders: number; cancellations: number; progress: string; created_at: string; updated_at: string | null };
export type Book = { member_id: string; month: string; title: string };
export type Todo = { id: string; member_id: string; todo_date: string; body: string; done: boolean; done_at: string | null; moved: boolean };
export type Task = { id: string; title: string; assignee_id: string; assigned_by: string; due_date: string; done: boolean; created_at: string };
export type Meeting = { id: string; host_id: string; title: string; starts_at: string; audience: 'direct' | 'team' | 'all'; team_of: string | null; meet_link: string; invitee_count: number };
export type Issue = { id: string; member_id: string; body: string; status: 'Open' | 'Resolved'; reply: string | null; replied_by: string | null; created_at: string };
export type Achievement = { id: string; member_id: string; title: string; kind: string; added_by: string | null; created_at: string };
export type Message = { id: string; conversation: string; sender_id: string; body: string; created_at: string };
export type ConvRead = { member_id: string; conversation: string; last_read_at: string };
export type Notification = { id: string; recipient_id: string; body: string; page: string; send_email: boolean; read: boolean; link: string | null; created_at: string };
export type NameRow = { id: string; name: string; status_rank: number; avatar_url: string | null };
