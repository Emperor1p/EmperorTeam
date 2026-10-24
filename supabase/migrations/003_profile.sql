-- Emperor · 003 profile photos and the top leader's outside sponsor
-- Run ONCE in Supabase → SQL Editor, after 002_app_support.sql.
-- Supabase may warn about "destructive operations": the only drops are a function and
-- policies that are recreated straight after. No data is removed.

-- ── Columns ────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists external_sponsor text
  check (external_sponsor is null or length(external_sponsor) between 1 and 80);

-- ── Who may change what on a profile ──────────────────────────────────
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
  -- Photo: only the person themselves, and only a file from their own folder in the avatars bucket.
  if new.avatar_url is distinct from old.avatar_url then
    if auth.uid() is distinct from new.id then raise exception 'Only you can change your photo'; end if;
    if new.avatar_url is not null and new.avatar_url !~ ('/storage/v1/object/public/avatars/' || new.id::text || '/[^/]+$') then
      raise exception 'Upload the photo through the app';
    end if;
  end if;
  -- Outside sponsor: only the top leader, on their own profile.
  if new.external_sponsor is distinct from old.external_sponsor then
    if auth.uid() is distinct from new.id then raise exception 'Only you can change this'; end if;
    if new.sponsor_id is not null then raise exception 'Only the top leader has a sponsor outside the app'; end if;
  end if;
  return new;
end $$;

-- ── Names for the org-wide feed now include the photo ─────────────────
drop function if exists public.member_names();
create function public.member_names()
returns table (id uuid, name text, status_rank int, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.status_rank, p.avatar_url from public.profiles p where auth.uid() is not null and p.onboarded;
$$;
revoke execute on function public.member_names() from public, anon;
grant execute on function public.member_names() to authenticated;

-- ── Photo storage: public to view, each person writes only their own folder ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatars are public" on storage.objects;
drop policy if exists "upload own avatar" on storage.objects;
drop policy if exists "update own avatar" on storage.objects;
drop policy if exists "delete own avatar" on storage.objects;
create policy "avatars are public" on storage.objects for select using (bucket_id = 'avatars');
create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
