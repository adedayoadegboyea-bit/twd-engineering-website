-- TW&D BOQ & quotation module (additive migration; does not alter existing tables)
create table if not exists public.boq_price_catalog (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  item_code text,
  description text not null,
  unit text not null,
  unit_rate numeric(15,2) not null default 0 check (unit_rate >= 0),
  currency text not null default 'NGN',
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boq_projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  client_email text,
  client_phone text,
  project_name text not null,
  project_type text not null,
  project_location text,
  dimensions jsonb not null default '{}'::jsonb,
  scope_notes text,
  subtotal numeric(15,2) not null default 0 check (subtotal >= 0),
  contingency_percent numeric(5,2) not null default 0 check (contingency_percent between 0 and 100),
  contingency_amount numeric(15,2) not null default 0 check (contingency_amount >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  tax_amount numeric(15,2) not null default 0 check (tax_amount >= 0),
  grand_total numeric(15,2) not null default 0 check (grand_total >= 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','PENDING_APPROVAL','CHANGES_REQUESTED','APPROVED','ISSUED','REJECTED')),
  quotation_number text unique,
  validity_days integer not null default 14 check (validity_days between 1 and 365),
  payment_terms text,
  admin_notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boq_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.boq_projects(id) on delete cascade,
  catalog_item_id uuid references public.boq_price_catalog(id) on delete set null,
  section text not null default 'General',
  description text not null,
  unit text not null default 'item',
  quantity numeric(15,3) not null default 0 check (quantity >= 0),
  unit_rate numeric(15,2) not null default 0 check (unit_rate >= 0),
  amount numeric(15,2) generated always as (round(quantity * unit_rate, 2)) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.boq_price_catalog enable row level security;
alter table public.boq_projects enable row level security;
alter table public.boq_items enable row level security;

drop policy if exists "Authenticated users can view active BOQ rates" on public.boq_price_catalog;
create policy "Authenticated users can view active BOQ rates"
on public.boq_price_catalog for select to authenticated
using (active = true or public.is_admin());

drop policy if exists "Admins manage BOQ rates" on public.boq_price_catalog;
create policy "Admins manage BOQ rates"
on public.boq_price_catalog for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Customers view own BOQ projects" on public.boq_projects;
create policy "Customers view own BOQ projects"
on public.boq_projects for select to authenticated
using (created_by = auth.uid() or public.is_admin());

drop policy if exists "Customers create BOQ drafts" on public.boq_projects;
create policy "Customers create BOQ drafts"
on public.boq_projects for insert to authenticated
with check (created_by = auth.uid() and status = 'DRAFT');

drop policy if exists "Customers update own BOQ drafts" on public.boq_projects;
create policy "Customers update own BOQ drafts"
on public.boq_projects for update to authenticated
using (created_by = auth.uid() and status in ('DRAFT','CHANGES_REQUESTED'))
with check (created_by = auth.uid() and status in ('DRAFT','CHANGES_REQUESTED'));

drop policy if exists "Admins manage BOQ projects" on public.boq_projects;
create policy "Admins manage BOQ projects"
on public.boq_projects for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users view BOQ items for accessible projects" on public.boq_items;
create policy "Users view BOQ items for accessible projects"
on public.boq_items for select to authenticated
using (exists (
  select 1 from public.boq_projects p
  where p.id = project_id and (p.created_by = auth.uid() or public.is_admin())
));

drop policy if exists "Users add items to own BOQ drafts" on public.boq_items;
create policy "Users add items to own BOQ drafts"
on public.boq_items for insert to authenticated
with check (exists (
  select 1 from public.boq_projects p
  where p.id = project_id and p.created_by = auth.uid()
    and p.status in ('DRAFT','CHANGES_REQUESTED')
));

drop policy if exists "Users update items in own BOQ drafts" on public.boq_items;
create policy "Users update items in own BOQ drafts"
on public.boq_items for update to authenticated
using (exists (
  select 1 from public.boq_projects p
  where p.id = project_id and p.created_by = auth.uid()
    and p.status in ('DRAFT','CHANGES_REQUESTED')
))
with check (exists (
  select 1 from public.boq_projects p
  where p.id = project_id and p.created_by = auth.uid()
    and p.status in ('DRAFT','CHANGES_REQUESTED')
));

drop policy if exists "Users delete items in own BOQ drafts" on public.boq_items;
create policy "Users delete items in own BOQ drafts"
on public.boq_items for delete to authenticated
using (exists (
  select 1 from public.boq_projects p
  where p.id = project_id and p.created_by = auth.uid()
    and p.status in ('DRAFT','CHANGES_REQUESTED')
));

drop policy if exists "Admins manage BOQ items" on public.boq_items;
create policy "Admins manage BOQ items"
on public.boq_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create index if not exists boq_price_catalog_active_idx on public.boq_price_catalog(active, category);
create index if not exists boq_projects_created_by_idx on public.boq_projects(created_by);
create index if not exists boq_projects_status_idx on public.boq_projects(status);
create index if not exists boq_items_project_id_idx on public.boq_items(project_id);

-- Deliberately no seed rates: TW&D must enter verified current rates before they are used.
