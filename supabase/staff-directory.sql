-- Run once in the existing TW&D Supabase project. Safe to rerun.
begin;

create table if not exists public.staff_directory (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  job_title text not null check (char_length(job_title) between 2 and 120),
  duties text not null check (char_length(duties) between 5 and 1200),
  photo_path text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.staff_directory
  add column if not exists department text check (char_length(department) <= 120);

-- Preserve any specifically delegated editors from the earlier directory.
create table if not exists public.staff_directory_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- The website uses the profile account type for administrator access.
-- Keep ordinary profile editing available while protecting that role field.
create or replace function public.protect_website_account_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if (case when tg_op = 'INSERT' then new.account_type is distinct from 'customer'
             else new.account_type is distinct from old.account_type end) then
      if not public.is_admin() then
        raise exception 'Only an administrator can change an account type.' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_website_account_type() from public, anon, authenticated;
drop trigger if exists protect_website_account_type on public.profiles;
create trigger protect_website_account_type
  before insert or update of account_type on public.profiles
  for each row execute function public.protect_website_account_type();

create or replace function public.is_staff_directory_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.is_admin(), false)
    or exists (select 1 from public.staff_directory_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_staff_directory_admin() from public, anon, authenticated;
grant execute on function public.is_staff_directory_admin() to authenticated;

create or replace function public.set_staff_directory_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.set_staff_directory_updated_at() from public, anon, authenticated;
drop trigger if exists set_staff_directory_updated_at on public.staff_directory;
create trigger set_staff_directory_updated_at
  before update on public.staff_directory
  for each row execute function public.set_staff_directory_updated_at();

alter table public.staff_directory enable row level security;
alter table public.staff_directory_admins enable row level security;
revoke all on public.staff_directory, public.staff_directory_admins from public, anon, authenticated;
grant select on public.staff_directory to anon, authenticated;
grant insert, update, delete on public.staff_directory to authenticated;

drop policy if exists "Public can see published staff" on public.staff_directory;
create policy "Public can see published staff" on public.staff_directory
  for select to anon, authenticated using (is_published);
drop policy if exists "Approved admins read staff" on public.staff_directory;
create policy "Approved admins read staff" on public.staff_directory
  for select to authenticated using ((select public.is_staff_directory_admin()));
drop policy if exists "Approved admins insert staff" on public.staff_directory;
create policy "Approved admins insert staff" on public.staff_directory
  for insert to authenticated with check ((select public.is_staff_directory_admin()));
drop policy if exists "Approved admins update staff" on public.staff_directory;
create policy "Approved admins update staff" on public.staff_directory
  for update to authenticated using ((select public.is_staff_directory_admin()))
  with check ((select public.is_staff_directory_admin()));
drop policy if exists "Approved admins delete staff" on public.staff_directory;
create policy "Approved admins delete staff" on public.staff_directory
  for delete to authenticated using ((select public.is_staff_directory_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-photos', 'staff-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads staff photos" on storage.objects;
create policy "Public reads staff photos" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'staff-photos' and exists (
      select 1 from public.staff_directory as member
      where member.photo_path = objects.name and member.is_published
    )
  );
drop policy if exists "Approved admins read staff photos" on storage.objects;
create policy "Approved admins read staff photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'staff-photos' and (select public.is_staff_directory_admin())
  );
drop policy if exists "Approved admins upload staff photos" on storage.objects;
create policy "Approved admins upload staff photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'staff-photos' and (select public.is_staff_directory_admin())
  );
drop policy if exists "Approved admins delete staff photos" on storage.objects;
create policy "Approved admins delete staff photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'staff-photos' and (select public.is_staff_directory_admin())
  );

notify pgrst, 'reload schema';
commit;
