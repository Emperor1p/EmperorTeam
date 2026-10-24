-- Emperor · 004 sponsor dropdown on the sign-up page
-- Run ONCE in Supabase → SQL Editor, after 003_profile.sql.
-- Lets the sign-up page list every member as a possible sponsor (name and status only;
-- no email, team, QPV or earnings). People still in the middle of sign-up are not listed.

create or replace function public.list_sponsors()
returns table (id uuid, name text, status_rank int)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.status_rank from public.profiles p
  where p.onboarded
  order by p.name;
$$;
grant execute on function public.list_sponsors() to anon, authenticated;
