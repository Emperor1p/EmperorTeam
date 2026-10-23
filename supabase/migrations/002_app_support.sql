-- Emperor · 002 app support
-- Run ONCE in Supabase → SQL Editor, after 001_schema.sql (which is already on your project).
-- What it does:
--   1. Fixes meeting access rules (the old ones referenced each other and errored).
--   2. Stops ordinary users calling internal functions (step_up, notify, …) directly.
--   3. Creates notifications on the server for orders, tasks, issues, achievements and meetings.
--   4. Handles QPV / earnings given at sign-up, and Google sign-ups that still need a sponsor.
--   5. Adds sponsor search for the sign-up page, a name directory, meeting creation and the email queue.

-- ── 1. Columns ─────────────────────────────────────────────────────────
alter table public.profiles add column if not exists onboarded boolean not null default true;
alter table public.notifications add column if not exists link text;
alter table public.meetings add column if not exists invitee_count int not null default 0;

-- ── 2. Lock down internal functions ───────────────────────────────────
revoke execute on function public.notify(uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.step_up(uuid, int) from public, anon, authenticated;
revoke execute on function public.daily_check() from public, anon, authenticated;
revoke execute on function public.upline_ids(uuid) from anon;
revoke execute on function public.team_ids(uuid) from anon;

-- ── 3. Meetings: fix recursive policies; create meetings only through create_meeting() ──
create or replace function public.is_meeting_host(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.meetings where id = m and host_id = auth.uid());
$$;
create or replace function public.is_meeting_invitee(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.meeting_invitees where meeting_id = m and member_id = auth.uid());
$$;
drop policy if exists "read meetings" on public.meetings;
drop policy if exists "host creates" on public.meetings;
drop policy if exists "read invites" on public.meeting_invitees;
drop policy if exists "host invites downline" on public.meeting_invitees;
create policy "read meetings" on public.meetings for select using (host_id = auth.uid() or public.is_meeting_invitee(id));
create policy "read invites" on public.meeting_invitees for select using (member_id = auth.uid() or public.is_meeting_host(meeting_id));

create or replace function public.create_meeting(p_title text, p_starts_at timestamptz, p_audience text, p_team_of uuid, p_link text)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid; n int; me uuid := auth.uid();
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  if length(trim(coalesce(p_title, ''))) < 3 then raise exception 'Give the meeting a title.'; end if;
  if (p_starts_at at time zone 'Africa/Lagos')::date < public.lagos_today() then raise exception 'Pick today or a future date.'; end if;
  if coalesce(p_link, '') !~ '^https://meet\.google\.com/\S+' then raise exception 'Paste a Google Meet link (https://meet.google.com/…).'; end if;
  if p_audience not in ('direct', 'team', 'all') then raise exception 'Choose who to invite.'; end if;
  if p_audience = 'team' and (p_team_of is null or not (me in (select public.upline_ids(p_team_of)))) then
    raise exception 'Choose a leg in your team.';
  end if;
  insert into public.meetings (host_id, title, starts_at, audience, team_of, meet_link)
    values (me, trim(p_title), p_starts_at, p_audience, case when p_audience = 'team' then p_team_of end, trim(p_link))
    returning id into mid;
  insert into public.meeting_invitees (meeting_id, member_id)
    select distinct mid, x from (
      select id as x from public.profiles where sponsor_id = me and p_audience = 'direct'
      union all select t from public.team_ids(p_team_of) t where p_audience = 'team'
      union all select t from public.team_ids(me) t where p_audience = 'all' and t <> me
    ) s where x <> me;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'No one to invite for this audience.'; end if;
  update public.meetings set invitee_count = n where id = mid;
  return mid;
end $$;
grant execute on function public.create_meeting(text, timestamptz, text, uuid, text) to authenticated;

-- invite notification (in-app + email, with the Meet link)
create or replace function public.after_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record; em text;
begin
  select * into m from public.meetings where id = new.meeting_id;
  select email into em from public.profiles where id = new.member_id;
  insert into public.notifications (recipient_id, body, page, send_email, link) values (new.member_id,
    'Meeting invite: ' || m.title || ' · ' || to_char(m.starts_at at time zone 'Africa/Lagos', 'FMDD Mon HH24:MI') || ' · sent to ' || em,
    'meetings', true, m.meet_link);
  return new;
end $$;
drop trigger if exists invite_notify on public.meeting_invitees;
create trigger invite_notify after insert on public.meeting_invitees for each row execute function public.after_invite();

-- ── 4. Profiles: guard, sign-up, Google sign-ups, status correction ───
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('emperor.system', true) = 'on' then return new; end if;
  if new.sponsor_id is distinct from old.sponsor_id then raise exception 'Sponsor cannot be changed'; end if;
  if new.onboarded is distinct from old.onboarded then raise exception 'Not allowed'; end if;
  if new.email is distinct from old.email then raise exception 'Email is changed from your account settings'; end if;
  if new.status_rank <> old.status_rank and not public.is_my_upline_of(new.id) then
    raise exception 'Only an upline can correct status';
  end if;
  return new;
end $$;

-- Shared by sign-up and complete_signup: opening earnings, "joined" notices, opening QPV.
create or replace function public.finish_join(member uuid, q int, earn numeric) returns void
language plpgsql security definer set search_path = public as $$
declare m record; sp_first text; u uuid; i int := 0;
  names text[] := array['Member','Distributor','Manager','Senior Manager','Executive Manager','Director','Emerald Director'];
begin
  select * into m from public.profiles where id = member;
  select split_part(name, ' ', 1) into sp_first from public.profiles where id = m.sponsor_id;
  perform set_config('emperor.system', 'on', true);
  if earn > 0 then
    insert into public.orders (member_id, project, platform, amount, order_date, status)
      values (member, 'Earnings this month before joining the app', 'Other', round(earn, 2), public.lagos_today(), 'Completed');
  end if;
  for u in select public.upline_ids(member) loop
    perform public.notify(u, m.name || ' joined ' || case when i = 0 then 'your team' else sp_first || '''s team' end
      || ' as ' || names[m.status_rank + 1]
      || case when q > 0 then ' · +' || q || ' QPV to your team' else '' end
      || case when earn > 0 then ' · +$' || to_char(round(earn), 'FM999,999,990') || ' team earnings' else '' end, 'team');
    i := i + 1;
  end loop;
  -- Joining as a Distributor counts as a new distributor for the whole sponsor line.
  if m.status_rank = 1 then
    i := 0;
    for u in select public.upline_ids(member) loop
      perform public.notify(u, case when i = 0 then 'You have a new distributor: ' || m.name
        else 'New distributor in ' || sp_first || '''s team: ' || m.name end, 'team');
      i := i + 1;
    end loop;
  end if;
  if q > 0 then insert into public.qpv_entries (member_id, amount) values (member, q); end if;
end $$;
revoke execute on function public.finish_join(uuid, int, numeric) from public, anon, authenticated;

-- Sign-up options.data: name, sponsor_id, status_rank, qpv, earn.
-- A sign-up with no valid sponsor only becomes the top leader if there is no top leader yet;
-- otherwise (e.g. "Continue with Google") the profile waits for complete_signup().
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  sp uuid; nm text; r int; q int; earn numeric; ok boolean;
begin
  sp := case when md->>'sponsor_id' ~ '^[0-9a-fA-F-]{36}$' then (md->>'sponsor_id')::uuid end;
  if sp is not null and not exists (select 1 from public.profiles where id = sp and onboarded) then sp := null; end if;
  nm := coalesce(nullif(trim(md->>'name'), ''), nullif(trim(md->>'full_name'), ''), split_part(new.email, '@', 1));
  r := case when md->>'status_rank' ~ '^[0-6]$' then (md->>'status_rank')::int else 0 end;
  q := case when md->>'qpv' ~ '^\d{1,7}$' then (md->>'qpv')::int else 0 end;
  earn := case when md->>'earn' ~ '^\d{1,9}(\.\d{1,2})?$' then (md->>'earn')::numeric else 0 end;
  ok := sp is not null or not exists (select 1 from public.profiles where sponsor_id is null and onboarded);
  insert into public.profiles (id, name, email, sponsor_id, status_rank, onboarded)
    values (new.id, nm, new.email, sp, case when ok then greatest(r, public.rank_from_qpv(q)) else 0 end, ok);
  if ok then perform public.finish_join(new.id, q, earn); end if;
  return new;
end $$;

create or replace function public.complete_signup(p_name text, p_sponsor uuid, p_rank int, p_qpv int, p_earn numeric)
returns void language plpgsql security definer set search_path = public as $$
declare me record; q int := greatest(coalesce(p_qpv, 0), 0); e numeric := greatest(coalesce(p_earn, 0), 0);
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Please sign in again.'; end if;
  if me.onboarded then raise exception 'Your account is already set up.'; end if;
  if p_sponsor is null or p_sponsor = me.id or not exists (select 1 from public.profiles where id = p_sponsor and onboarded) then
    raise exception 'Choose your sponsor.';
  end if;
  if length(trim(coalesce(p_name, ''))) < 3 or position(' ' in trim(p_name)) = 0 then raise exception 'Enter your first and last name.'; end if;
  perform set_config('emperor.system', 'on', true);
  update public.profiles set sponsor_id = p_sponsor, name = trim(p_name), onboarded = true,
    status_rank = greatest(least(greatest(coalesce(p_rank, 0), 0), 6), public.rank_from_qpv(q))
    where id = me.id;
  perform public.finish_join(me.id, q, round(e, 2));
end $$;
grant execute on function public.complete_signup(text, uuid, int, int, numeric) to authenticated;

create or replace function public.correct_status(member uuid, new_rank int) returns void
language plpgsql security definer set search_path = public as $$
declare names text[] := array['Member','Distributor','Manager','Senior Manager','Executive Manager','Director','Emerald Director'];
  by_name text;
begin
  if not public.is_my_upline_of(member) then raise exception 'Not your downline'; end if;
  if new_rank < 0 or new_rank > 6 then raise exception 'Invalid status'; end if;
  if new_rank > (select status_rank from public.profiles where id = member) then perform public.step_up(member, new_rank);
  elsif new_rank < (select status_rank from public.profiles where id = member) then
    select name into by_name from public.profiles where id = auth.uid();
    perform set_config('emperor.system', 'on', true);
    update public.profiles set status_rank = new_rank where id = member;
    perform public.notify(member, 'Your status was corrected to ' || names[new_rank + 1] || ' by ' || by_name, 'dashboard');
  end if;
end $$;
grant execute on function public.correct_status(uuid, int) to authenticated;

-- Sign-up page helpers (safe for signed-out visitors: names + status only)
create or replace function public.org_has_root() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where sponsor_id is null and onboarded);
$$;
create or replace function public.find_sponsors(q text)
returns table (id uuid, name text, status_rank int)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.status_rank from public.profiles p
  where p.onboarded and length(trim(q)) >= 3
    and p.name ilike '%' || replace(replace(trim(q), '%', ''), '_', '') || '%'
  order by p.name limit 8;
$$;
create or replace function public.sponsor_card(p_id uuid)
returns table (id uuid, name text, status_rank int)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.status_rank from public.profiles p where p.id = p_id and p.onboarded;
$$;
grant execute on function public.org_has_root() to anon, authenticated;
grant execute on function public.find_sponsors(text) to anon, authenticated;
grant execute on function public.sponsor_card(uuid) to anon, authenticated;

-- Names for the org-wide achievements feed (no other details)
create or replace function public.member_names()
returns table (id uuid, name text, status_rank int)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.status_rank from public.profiles p where auth.uid() is not null and p.onboarded;
$$;
revoke execute on function public.member_names() from anon;
grant execute on function public.member_names() to authenticated;

-- ── 5. Activity: any check-in, to-do, order, task tick or message counts ──
create or replace function public.touch_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  who := (to_jsonb(new) ->> case tg_table_name when 'messages' then 'sender_id' when 'tasks' then 'assignee_id' else 'member_id' end)::uuid;
  update public.profiles set last_active_at = now() where id = who;
  return new;
end $$;
drop trigger if exists touch_logs on public.daily_logs;
drop trigger if exists touch_todos on public.todos;
drop trigger if exists touch_orders on public.orders;
drop trigger if exists touch_msgs on public.messages;
create trigger touch_logs after insert or update on public.daily_logs for each row execute function public.touch_member();
create trigger touch_todos after insert or update on public.todos for each row execute function public.touch_member();
create trigger touch_orders after insert on public.orders for each row execute function public.touch_member();
create trigger touch_msgs after insert on public.messages for each row execute function public.touch_member();

-- ── 6. Orders: notify sponsor; members may only complete or cancel an active order ──
create or replace function public.after_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if current_setting('emperor.system', true) = 'on' then return new; end if;
  select * into m from public.profiles where id = new.member_id;
  if m.sponsor_id is not null then
    perform public.notify(m.sponsor_id, m.name || ' logged an order: ' || new.project || ' · $' || to_char(round(new.amount), 'FM999,999,990'), 'orders');
  end if;
  return new;
end $$;
drop trigger if exists order_notify on public.orders;
create trigger order_notify after insert on public.orders for each row execute function public.after_order();

create or replace function public.guard_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.member_id, new.project, new.platform, new.amount, new.order_date) is distinct from
     (old.member_id, old.project, old.platform, old.amount, old.order_date) then
    raise exception 'Orders can only be completed or cancelled';
  end if;
  if new.status <> old.status and old.status <> 'Active' then raise exception 'Only active orders can change status'; end if;
  return new;
end $$;
drop trigger if exists order_guard on public.orders;
create trigger order_guard before update on public.orders for each row execute function public.guard_order();

-- ── 7. Tasks: notify assignee; assignee can only tick; notify assigner on completion ──
create or replace function public.after_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record; b record;
begin
  select * into a from public.profiles where id = new.assignee_id;
  select * into b from public.profiles where id = new.assigned_by;
  if tg_op = 'INSERT' then
    perform public.notify(new.assignee_id, 'New task from ' || split_part(b.name, ' ', 1) || ': ' || new.title, 'tasks', true);
  elsif new.done and not old.done then
    perform public.notify(new.assigned_by, a.name || ' completed: ' || new.title, 'tasks');
  end if;
  return new;
end $$;
drop trigger if exists task_notify on public.tasks;
create trigger task_notify after insert or update on public.tasks for each row execute function public.after_task();

create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.title, new.assignee_id, new.assigned_by, new.due_date) is distinct from (old.title, old.assignee_id, old.assigned_by, old.due_date) then
    raise exception 'Only the done tick can change';
  end if;
  return new;
end $$;
drop trigger if exists task_guard on public.tasks;
create trigger task_guard before update on public.tasks for each row execute function public.guard_task();
drop trigger if exists touch_tasks on public.tasks;
create trigger touch_tasks after update on public.tasks for each row execute function public.touch_member();

-- ── 8. Issues: notify the whole upline; notify author on reply ─────────
create or replace function public.after_issue() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record; sp_first text; u uuid; i int := 0; r_first text;
begin
  select * into m from public.profiles where id = new.member_id;
  if tg_op = 'INSERT' then
    select split_part(name, ' ', 1) into sp_first from public.profiles where id = m.sponsor_id;
    for u in select public.upline_ids(new.member_id) loop
      perform public.notify(u, m.name || case when i > 0 then ' (' || sp_first || '''s team)' else '' end || ' raised an issue: ' || new.body, 'issues');
      i := i + 1;
    end loop;
    update public.profiles set last_active_at = now() where id = new.member_id;
  elsif new.reply is distinct from old.reply and new.reply is not null then
    select split_part(name, ' ', 1) into r_first from public.profiles where id = new.replied_by;
    perform public.notify(new.member_id, r_first || ' replied to your issue: ' || new.reply, 'issues');
  end if;
  return new;
end $$;
drop trigger if exists issue_notify on public.issues;
create trigger issue_notify after insert or update on public.issues for each row execute function public.after_issue();

create or replace function public.guard_issue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.member_id, new.body, new.created_at) is distinct from (old.member_id, old.body, old.created_at) then raise exception 'Not allowed'; end if;
  if new.reply is distinct from old.reply then new.replied_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists issue_guard on public.issues;
create trigger issue_guard before update on public.issues for each row execute function public.guard_issue();

-- ── 9. Achievements added by a person: notify them and their upline ──
create or replace function public.after_achievement() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record; by_first text; u uuid;
begin
  if new.added_by is null then return new; end if;
  select * into m from public.profiles where id = new.member_id;
  select split_part(name, ' ', 1) into by_first from public.profiles where id = new.added_by;
  if new.member_id <> new.added_by then
    perform public.notify(new.member_id, by_first || ' added an achievement for you: ' || new.title, 'achievements');
  end if;
  for u in select public.upline_ids(new.member_id) loop
    if u <> new.added_by then perform public.notify(u, 'Achievement · ' || m.name || ': ' || new.title, 'achievements'); end if;
  end loop;
  return new;
end $$;
drop trigger if exists achievement_notify on public.achievements;
create trigger achievement_notify after insert on public.achievements for each row execute function public.after_achievement();

-- ── 10. Email queue (used by the app's /api/emails route with the service role key) ──
create or replace function public.claim_email_batch(max_rows int default 50)
returns table (id uuid, email text, name text, body text, page text, link text)
language sql security definer set search_path = public as $$
  with c as (
    update public.notifications n set emailed_at = now()
    where n.id in (
      select x.id from public.notifications x
      where x.send_email and x.emailed_at is null and x.created_at > now() - interval '3 days'
      order by x.created_at limit max_rows for update skip locked)
    returning n.id, n.recipient_id, n.body, n.page, n.link)
  select c.id, p.email, p.name, c.body, c.page, c.link from c join public.profiles p on p.id = c.recipient_id;
$$;
revoke execute on function public.claim_email_batch(int) from public, anon, authenticated;
grant execute on function public.claim_email_batch(int) to service_role;

-- ── 11. Daily 9 PM check: skip accounts still finishing sign-up ───────
create or replace function public.daily_check() returns void
language plpgsql security definer set search_path = public as $$
declare p record; d date := public.lagos_today(); idle int; miss_log boolean; miss_todo boolean;
begin
  for p in select * from public.profiles where onboarded loop
    miss_log := not exists (select 1 from public.daily_logs where member_id = p.id and log_date = d);
    miss_todo := not exists (select 1 from public.todos where member_id = p.id and todo_date = d);
    if miss_log or miss_todo then
      perform public.notify(p.id, 'You missed today''s ' || case when miss_log and miss_todo then 'daily check-in and to-do list'
        when miss_log then 'daily check-in' else 'to-do list' end, 'day', true);
    end if;
    idle := d - (p.last_active_at at time zone 'Africa/Lagos')::date;
    if idle = 7 then perform public.notify(p.id, 'You haven''t been active for a week. Check in today to stay active.', 'day', true);
    elsif idle in (14, 21, 28) then perform public.notify(p.id, 'You are now an inactive member. Submit a check-in to become active again.', 'day', true);
    end if;
  end loop;
end $$;
revoke execute on function public.daily_check() from public, anon, authenticated;

-- ── 12. Realtime for the remaining tables ─────────────────────────────
do $$ declare t text; begin
  foreach t in array array['tasks','meetings','meeting_invitees','achievements','books','conversation_reads'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
