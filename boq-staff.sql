-- Optional authorised-estimator access for the BOQ module.
-- Run after boq-schema.sql. Existing profile account types are not changed.
create table if not exists public.boq_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'estimator' check (role in ('estimator')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.boq_staff enable row level security;

drop policy if exists "Admins manage BOQ estimator access" on public.boq_staff;
create policy "Admins manage BOQ estimator access"
on public.boq_staff for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Estimators can view their own BOQ access" on public.boq_staff;
create policy "Estimators can view their own BOQ access"
on public.boq_staff for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create or replace function public.is_boq_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (select 1 from public.boq_staff s where s.user_id = auth.uid());
$$;

-- Additive staff policies. Existing admin-only policies remain in place and
-- continue to protect administrator access; these policies additionally allow
-- explicitly authorised estimators to manage BOQ records.
drop policy if exists "BOQ staff manage rates" on public.boq_price_catalog;
create policy "BOQ staff manage rates"
on public.boq_price_catalog for all to authenticated
using (public.is_boq_staff()) with check (public.is_boq_staff());

drop policy if exists "BOQ staff manage projects" on public.boq_projects;
create policy "BOQ staff manage projects"
on public.boq_projects for all to authenticated
using (public.is_boq_staff()) with check (public.is_boq_staff());

drop policy if exists "BOQ staff manage items" on public.boq_items;
create policy "BOQ staff manage items"
on public.boq_items for all to authenticated
using (public.is_boq_staff()) with check (public.is_boq_staff());
