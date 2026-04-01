-- Seed or promote admin profiles from an explicit email allowlist.
-- Replace the sample emails below before running.


with admin_emails as (
  select lower(trim(email)) as email
  from unnest(array[
    'admin1@example.com',
    'admin2@example.com'
  ]) as email
),
matched_users as (
  select
    u.id,
    lower(u.email) as email,
    coalesce(u.raw_user_meta_data ->> 'first_name', '') as first_name,
    coalesce(u.raw_user_meta_data ->> 'last_name', '') as last_name
  from auth.users u
  inner join admin_emails a
    on lower(u.email) = a.email
)
insert into public.profiles (id, email, first_name, last_name, role)
select
  id,
  email,
  nullif(first_name, ''),
  nullif(last_name, ''),
  'admin'
from matched_users
on conflict (id) do update
set
  email = excluded.email,
  first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name),
  last_name = coalesce(nullif(excluded.last_name, ''), public.profiles.last_name),
  role = 'admin';
