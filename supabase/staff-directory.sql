-- TW&D staff directory: run in the existing Supabase project's SQL editor.
-- IMPORTANT: replace the UUID in the final INSERT with the verified admin's auth.users ID.
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
create table if not exists public.staff_directory_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
-- The dashboard checks this RPC; only approved admins return true.
create or replace function public.is_staff_directory_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.staff_directory_admins where user_id = (select auth.uid())); $$;
revoke all on function public.is_staff_directory_admin() from public;
grant execute on function public.is_staff_directory_admin() to authenticated;
alter table public.staff_directory enable row level security;
alter table public.staff_directory_admins enable row level security;
revoke all on public.staff_directory from anon, authenticated;
grant select on public.staff_directory to anon, authenticated;
grant insert, update, delete on public.staff_directory to authenticated;
revoke all on public.staff_directory_admins from anon, authenticated;
create policy "Public can see published staff" on public.staff_directory
 for select to anon, authenticated using (
 is_published = true or (select public.is_staff_directory_admin())
 );
create policy "Approved admins insert staff" on public.staff_directory
 for insert to authenticated with check ((select public.is_staff_directory_admin()));
create policy "Approved admins update staff" on public.staff_directory
 for update to authenticated using ((select public.is_staff_directory_admin()))
 with check ((select public.is_staff_directory_admin()));
create policy "Approved admins delete staff" on public.staff_directory
 for delete to authenticated using ((select public.is_staff_directory_admin()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('staff-photos','staff-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict (id) do nothing;
create policy "Public reads staff photos" on storage.objects
 for select to anon,authenticated using (bucket_id='staff-photos');
create policy "Approved admins upload staff photos" on storage.objects
 for insert to authenticated with check (bucket_id='staff-photos' and (select public.is_staff_directory_admin()));
create policy "Approved admins delete staff photos" on storage.objects
 for delete to authenticated using (bucket_id='staff-photos' and (select public.is_staff_directory_admin()));
-- After creating an admin account through Supabase Auth, run separately:
-- insert into public.staff_directory_admins(user_id) values ('REPLACE-WITH-VERIFIED-AUTH-USER-UUID');
