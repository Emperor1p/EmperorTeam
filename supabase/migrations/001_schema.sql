-- Emperor · Supabase schema
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run once on an empty project.
-- Statuses: 0 Member, 1 Distributor, 2 Manager, 3 Senior Manager, 4 Executive Manager, 5 Director, 6 Emerald Director

create extension if not exists pg_cron;

-- ── Tables ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null unique,
  sponsor_id uuid references public.profiles(id),
  status_rank int not null default 0 check (status_rank between 0 and 6),
  google_connected boolean not null default false,
  joined_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
create index on public.profiles (sponsor_id);

create table public.qpv_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null default (now() at time zone 'Africa/Lagos')::date,
  amount int not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index on public.qpv_entries (member_id, entry_date);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  project text not null,
  platform text not null check (platform in ('Fiverr','Upwork','Direct client','Other')),
  amount numeric(12,2) not null check (amount > 0),
  order_date date not null,
  status text not null default 'Active' check (status in ('Active','Completed','Cancelled')),
  created_at timestamptz not null default now()
);
create index on public.orders (member_id, order_date);

create table public.daily_logs (
  member_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  fiverr_msgs int not null default 0 check (fiverr_msgs >= 0),
  upwork_msgs int not null default 0 check (upwork_msgs >= 0),
  orders int not null default 0 check (orders >= 0),
  cancellations int not null default 0 check (cancellations >= 0),
  progress text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (member_id, log_date)
);

create table public.books (
  member_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  title text not null,
  primary key (member_id, month)
);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  todo_date date not null,
  body text not null,
  done boolean not null default false,
  done_at timestamptz,
  moved boolean not null default false
);
create index on public.todos (member_id, todo_date);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assignee_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  due_date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id),
  title text not null,
  starts_at timestamptz not null,
  audience text not null check (audience in ('direct','team','all')),
  team_of uuid references public.profiles(id),
  meet_link text not null check (meet_link like 'https://meet.google.com/%'),
  created_at timestamptz not null default now()
);
create table public.meeting_invitees (
  meeting_id uuid references public.meetings on delete cascade,
  member_id uuid references public.profiles on delete cascade,
  primary key (meeting_id, member_id)
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  status text not null default 'Open' check (status in ('Open','Resolved')),
  reply text,
  replied_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('Step up','New tool','Recognition','Milestone','Other')),
  added_by uuid references public.profiles(id), -- null = automatic
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation text not null, -- 'team:<uuid>' or 'dm:<uuidA>|<uuidB>' (sorted)
  sender_id uuid not null references public.profiles(id),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.messages (conversation, created_at);
create table public.conversation_reads (
  member_id uuid references public.profiles on delete cascade,
  conversation text,
  last_read_at timestamptz not null default now(),
  primary key (member_id, conversation)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  page text not null default 'dashboard',
  send_email boolean not null default false,
  emailed_at timestamptz,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (recipient_id, created_at desc);

-- ── Helpers ────────────────────────────────────────────────────────────
create or replace function public.lagos_today() returns date language sql stable as
$$ select (now() at time zone 'Africa/Lagos')::date $$;
create or replace function public.month_start() returns date language sql stable as
$$ select date_trunc('month', public.lagos_today())::date $$;

-- true if the caller is `target` or anywhere above them in the sponsor line
create or replace function public.can_see(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, sponsor_id from public.profiles where id = target
    union all
    select p.id, p.sponsor_id from public.profiles p join chain c on p.id = c.sponsor_id
  ) select exists (select 1 from chain where id = auth.uid());
$$;
-- true if `target` is above the caller (sponsor, sponsor's sponsor …)
create or replace function public.is_my_upline(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select sponsor_id from public.profiles where id = auth.uid()
    union all
    select p.sponsor_id from public.profiles p join chain c on p.id = c.sponsor_id
  ) select exists (select 1 from chain where sponsor_id = target);
$$;
create or replace function public.upline_ids(member uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select sponsor_id as id from public.profiles where id = member
    union all
    select p.sponsor_id from public.profiles p join chain c on p.id = c.id where p.sponsor_id is not null
  ) select id from chain where id is not null;
$$;
create or replace function public.team_ids(root uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with recursive t as (
    select id from public.profiles where id = root
    union all
    select p.id from public.profiles p join t on p.sponsor_id = t.id
  ) select id from t;
$$;
create or replace function public.rank_from_qpv(q bigint) returns int language sql immutable as $$
  select case when q >= 4000 then 5 when q >= 2000 then 4 when q >= 1000 then 3 when q >= 500 then 2 when q >= 100 then 1 else 0 end;
$$;
create or replace function public.can_access_conversation(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when c like 'team:%' then public.can_see(auth.uid()) and auth.uid() in (select public.team_ids(substring(c from 6)::uuid))
    when c like 'dm:%' then auth.uid()::text = any (string_to_array(substring(c from 4), '|'))
    else false end;
$$;

-- Team totals for the current month (QPV and earnings reset on the 1st; history is kept)
create or replace view public.member_month_stats with (security_invoker = true) as
select p.id,
  coalesce((select sum(amount) from public.qpv_entries q where q.member_id = p.id and q.entry_date >= public.month_start()), 0) as own_qpv,
  coalesce((select sum(q.amount) from public.qpv_entries q where q.member_id in (select public.team_ids(p.id)) and q.entry_date >= public.month_start()), 0) as total_qpv,
  coalesce((select sum(amount) from public.orders o where o.member_id = p.id and o.status <> 'Cancelled' and o.order_date >= public.month_start()), 0) as personal_earnings,
  coalesce((select sum(o.amount) from public.orders o where o.member_id in (select public.team_ids(p.id)) and o.status <> 'Cancelled' and o.order_date >= public.month_start()), 0) as team_earnings,
  (select count(*) from public.team_ids(p.id)) as team_size
from public.profiles p;

-- ── Notifications + step-ups (status never goes down) ─────────────────
create or replace function public.notify(recipient uuid, body text, page text default 'dashboard', email boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (recipient_id, body, page, send_email) values (recipient, body, page, email);
$$;

create or replace function public.step_up(member uuid, new_rank int) returns void
language plpgsql security definer set search_path = public as $$
declare m record; sp_first text; u uuid; i int := 0;
  names text[] := array['Member','Distributor','Manager','Senior Manager','Executive Manager','Director','Emerald Director'];
begin
  select * into m from public.profiles where id = member;
  if new_rank <= m.status_rank then return; end if;
  perform set_config('emperor.system', 'on', true);
  update public.profiles set status_rank = new_rank where id = member;
  insert into public.achievements (member_id, title, kind, dedupe_key)
    values (member, 'Stepped up to ' || names[new_rank + 1], 'Step up', 'step:' || member || ':' || new_rank) on conflict do nothing;
  perform public.notify(member, case when new_rank = 1 then 'You are now a Distributor. Welcome aboard!' else 'Congratulations, you stepped up to ' || names[new_rank + 1] end, 'achievements');
  select split_part(name, ' ', 1) into sp_first from public.profiles where id = m.sponsor_id;
  for u in select public.upline_ids(member) loop
    perform public.notify(u, case
      when i = 0 and new_rank = 1 then 'You have a new distributor: ' || m.name
      when new_rank = 1 then 'New distributor in ' || sp_first || '''s team: ' || m.name
      when i = 0 then 'Your direct leg ' || m.name || ' stepped up to ' || names[new_rank + 1]
      else m.name || ' (' || sp_first || '''s team) stepped up to ' || names[new_rank + 1] end, 'team');
    i := i + 1;
  end loop;
end $$;

-- After QPV is added: re-check the member and every upline against their team total
create or replace function public.after_qpv() returns trigger
language plpgsql security definer set search_path = public as $$
declare x uuid; tq bigint;
begin
  for x in select new.member_id union all select public.upline_ids(new.member_id) loop
    select coalesce(sum(amount), 0) into tq from public.qpv_entries
      where member_id in (select public.team_ids(x)) and entry_date >= public.month_start();
    perform public.step_up(x, public.rank_from_qpv(tq));
  end loop;
  update public.profiles set last_active_at = now() where id = new.member_id;
  return new;
end $$;
create trigger qpv_step_up after insert on public.qpv_entries for each row execute function public.after_qpv();

-- Members can't change their own status or sponsor; only an upline (correction) or the system can
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('emperor.system', true) = 'on' then return new; end if;
  if new.sponsor_id is distinct from old.sponsor_id then raise exception 'Sponsor cannot be changed'; end if;
  if new.status_rank <> old.status_rank and not public.is_my_upline_of(new.id) then
    raise exception 'Only an upline can correct status';
  end if;
  return new;
end $$;
create or replace function public.is_my_upline_of(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() in (select public.upline_ids(target));
$$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

-- New sign-up → profile (name, sponsor_id, status_rank come from signUp options.data)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare sp uuid := nullif(new.raw_user_meta_data->>'sponsor_id','')::uuid; nm text := coalesce(new.raw_user_meta_data->>'name', new.email);
  r int := least(greatest(coalesce((new.raw_user_meta_data->>'status_rank')::int, 0), 0), 6); u uuid;
begin
  insert into public.profiles (id, name, email, sponsor_id, status_rank) values (new.id, nm, new.email, sp, r);
  for u in select public.upline_ids(new.id) loop perform public.notify(u, nm || ' joined your team', 'team'); end loop;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ── Row Level Security ─────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.qpv_entries enable row level security;
alter table public.orders enable row level security;
alter table public.daily_logs enable row level security;
alter table public.books enable row level security;
alter table public.todos enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_invitees enable row level security;
alter table public.issues enable row level security;
alter table public.achievements enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.notifications enable row level security;

create policy "see self, team and upline" on public.profiles for select using (public.can_see(id) or public.is_my_upline(id));
create policy "edit own profile or correct downline" on public.profiles for update using (id = auth.uid() or public.is_my_upline_of(id));

create policy "read team qpv" on public.qpv_entries for select using (public.can_see(member_id));
create policy "add own qpv" on public.qpv_entries for insert with check (member_id = auth.uid());

create policy "read team orders" on public.orders for select using (public.can_see(member_id));
create policy "add own orders" on public.orders for insert with check (member_id = auth.uid());
create policy "update own orders" on public.orders for update using (member_id = auth.uid());

create policy "read team logs" on public.daily_logs for select using (public.can_see(member_id));
create policy "write own log" on public.daily_logs for all using (member_id = auth.uid()) with check (member_id = auth.uid() and log_date = public.lagos_today());

create policy "read team books" on public.books for select using (public.can_see(member_id));
create policy "write own book" on public.books for all using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy "read team todos" on public.todos for select using (public.can_see(member_id));
create policy "write own todos" on public.todos for all using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy "read tasks" on public.tasks for select using (assignee_id = auth.uid() or assigned_by = auth.uid() or public.can_see(assignee_id));
create policy "assign to downline" on public.tasks for insert with check (assigned_by = auth.uid() and public.is_my_upline_of(assignee_id));
create policy "assignee ticks" on public.tasks for update using (assignee_id = auth.uid());

create policy "read meetings" on public.meetings for select using (host_id = auth.uid() or exists (select 1 from public.meeting_invitees i where i.meeting_id = id and i.member_id = auth.uid()));
create policy "host creates" on public.meetings for insert with check (host_id = auth.uid());
create policy "read invites" on public.meeting_invitees for select using (member_id = auth.uid() or exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid()));
create policy "host invites downline" on public.meeting_invitees for insert with check (exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid()) and public.is_my_upline_of(member_id));

create policy "read issues up the line" on public.issues for select using (public.can_see(member_id));
create policy "raise own issue" on public.issues for insert with check (member_id = auth.uid());
create policy "upline replies" on public.issues for update using (public.is_my_upline_of(member_id));

create policy "everyone reads achievements" on public.achievements for select using (auth.role() = 'authenticated');
create policy "add for self or downline" on public.achievements for insert with check (added_by = auth.uid() and kind <> 'Step up' and public.can_see(member_id));

create policy "read my conversations" on public.messages for select using (public.can_access_conversation(conversation));
create policy "send in my conversations" on public.messages for insert with check (sender_id = auth.uid() and public.can_access_conversation(conversation));
create policy "own read markers" on public.conversation_reads for all using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy "read own notifications" on public.notifications for select using (recipient_id = auth.uid());
create policy "mark own read" on public.notifications for update using (recipient_id = auth.uid());

-- Downline status correction (UI "Correct status")
create or replace function public.correct_status(member uuid, new_rank int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_my_upline_of(member) then raise exception 'Not your downline'; end if;
  if new_rank > (select status_rank from public.profiles where id = member) then perform public.step_up(member, new_rank);
  else
    perform set_config('emperor.system', 'on', true);
    update public.profiles set status_rank = new_rank where id = member;
    perform public.notify(member, 'Your status was corrected by your upline', 'dashboard');
  end if;
end $$;
grant execute on function public.correct_status(uuid, int) to authenticated;

-- ── Realtime ───────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.messages, public.notifications, public.orders, public.qpv_entries, public.profiles, public.issues, public.todos, public.daily_logs;

-- ── Daily 9:00 PM Lagos check (20:00 UTC) ──────────────────────────────
create or replace function public.daily_check() returns void
language plpgsql security definer set search_path = public as $$
declare p record; d date := public.lagos_today(); idle int;
begin
  for p in select * from public.profiles loop
    if not exists (select 1 from public.daily_logs where member_id = p.id and log_date = d)
       or not exists (select 1 from public.todos where member_id = p.id and todo_date = d) then
      perform public.notify(p.id, 'You missed today''s daily check-in or to-do list', 'day', true);
    end if;
    idle := d - (p.last_active_at at time zone 'Africa/Lagos')::date;
    if idle = 7 then perform public.notify(p.id, 'You haven''t been active for a week. Check in today to stay active.', 'day', true);
    elsif idle in (14, 21, 28) then perform public.notify(p.id, 'You are now an inactive member. Submit a check-in to become active again.', 'day', true);
    end if;
  end loop;
end $$;
select cron.schedule('emperor-daily-check', '0 20 * * *', 'select public.daily_check()');
