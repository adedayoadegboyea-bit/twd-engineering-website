-- TW&D SCHOOL ADVERTS — ADDITIVE DATABASE MODULE
-- Run this after the existing supabase-schema.sql in the Supabase SQL Editor.
create table if not exists public.site_adverts (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  title text not null,
  tagline text,
  description text not null,
  image_url text,
  cta_label text not null default 'Enquire / Apply',
  cta_url text not null default 'mailto:twedprivateschools@gmail.com',
  active boolean not null default false,
  priority integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_adverts enable row level security;
drop policy if exists "Public can view active school adverts" on public.site_adverts;
create policy "Public can view active school adverts" on public.site_adverts
for select to anon, authenticated using(active=true);
drop policy if exists "Admins can manage school adverts" on public.site_adverts;
create policy "Admins can manage school adverts" on public.site_adverts
for all to authenticated using(public.is_admin()) with check(public.is_admin());

insert into storage.buckets (id,name,public) values ('site-adverts','site-adverts',true)
on conflict (id) do update set public=true;
drop policy if exists "Public can view advert images" on storage.objects;
create policy "Public can view advert images" on storage.objects for select to anon, authenticated
using(bucket_id='site-adverts');
drop policy if exists "Admins can manage advert images" on storage.objects;
create policy "Admins can manage advert images" on storage.objects for all to authenticated
using(bucket_id='site-adverts' and public.is_admin())
with check(bucket_id='site-adverts' and public.is_admin());
