create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  account_type text not null default 'customer' check (account_type in ('customer','seller','worker','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  project_name text not null,
  project_code text unique,
  service_type text,
  location text,
  status text not null default 'REQUESTED',
  progress integer not null default 0 check(progress between 0 and 100),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  report_title text not null,
  report_body text not null,
  progress integer check(progress between 0 and 100),
  report_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  document_name text not null,
  document_type text,
  storage_path text,
  description text,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null,
  subject text not null,
  message text not null,
  status text not null default 'SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  quotation_number text unique,
  amount numeric(15,2),
  currency text not null default 'NGN',
  status text not null default 'DRAFT',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  business_description text,
  whatsapp text,
  location text,
  subscription_plan text,
  subscription_status text not null default 'NONE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $fn$
begin
  insert into public.profiles(id,full_name,phone,email)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'phone',''),new.email)
  on conflict(id) do update set full_name=excluded.full_name,phone=excluded.phone,email=excluded.email,updated_at=now();
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and account_type='admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_reports enable row level security;
alter table public.project_documents enable row level security;
alter table public.service_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.quotations enable row level security;
alter table public.seller_profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles" on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Customers can view own projects" on public.projects;
create policy "Customers can view own projects" on public.projects for select to authenticated using(customer_id=auth.uid() or public.is_admin());

drop policy if exists "Admins can manage projects" on public.projects;
create policy "Admins can manage projects" on public.projects for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Customers can view own project reports" on public.project_reports;
create policy "Customers can view own project reports" on public.project_reports for select to authenticated using(customer_id=auth.uid() or public.is_admin());

drop policy if exists "Admins can manage project reports" on public.project_reports;
create policy "Admins can manage project reports" on public.project_reports for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Customers can view own project documents" on public.project_documents;
create policy "Customers can view own project documents" on public.project_documents for select to authenticated using(customer_id=auth.uid() or public.is_admin());

drop policy if exists "Admins can manage project documents" on public.project_documents;
create policy "Admins can manage project documents" on public.project_documents for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Customers can create own service requests" on public.service_requests;
create policy "Customers can create own service requests" on public.service_requests for insert to authenticated with check(customer_id=auth.uid());

drop policy if exists "Customers can view own service requests" on public.service_requests;
create policy "Customers can view own service requests" on public.service_requests for select to authenticated using(customer_id=auth.uid() or public.is_admin());

drop policy if exists "Admins can manage service requests" on public.service_requests;
create policy "Admins can manage service requests" on public.service_requests for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Customers can view own notifications" on public.notifications;
create policy "Customers can view own notifications" on public.notifications for select to authenticated using(customer_id=auth.uid() or public.is_admin());

drop policy if exists "Customers can mark own notifications read" on public.notifications;
create policy "Customers can mark own notifications read" on public.notifications for update to authenticated using(customer_id=auth.uid()) with check(customer_id=auth.uid());

drop policy if exists "Admins can manage notifications" on public.notifications;
create policy "Admins can manage notifications" on public.notifications for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Customers can view own quotations" on public.quotations;
create policy "Customers can view own quotations" on public.quotations for select to authenticated using(customer_id=auth.uid() or public.is_admin());

drop policy if exists "Admins can manage quotations" on public.quotations;
create policy "Admins can manage quotations" on public.quotations for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Sellers can view own seller profile" on public.seller_profiles;
create policy "Sellers can view own seller profile" on public.seller_profiles for select to authenticated using(id=auth.uid() or public.is_admin());

drop policy if exists "Sellers can update own seller profile" on public.seller_profiles;
create policy "Sellers can update own seller profile" on public.seller_profiles for update to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());

revoke update(account_type) on public.profiles from authenticated;

insert into storage.buckets (id,name,public)
values ('project-private','project-private',false)
on conflict (id) do update set public=false;

drop policy if exists "Admins can manage private project files" on storage.objects;
create policy "Admins can manage private project files"
on storage.objects for all to authenticated
using(bucket_id='project-private' and public.is_admin())
with check(bucket_id='project-private' and public.is_admin());

drop policy if exists "Customers can read their private project files" on storage.objects;
create policy "Customers can read their private project files"
on storage.objects for select to authenticated
using(
  bucket_id='project-private'
  and exists(
    select 1
    from public.project_documents d
    where d.storage_path=name
      and d.customer_id=auth.uid()
  )
);

create index if not exists projects_customer_id_idx on public.projects(customer_id);
create index if not exists project_reports_project_id_idx on public.project_reports(project_id);
create index if not exists project_reports_customer_id_idx on public.project_reports(customer_id);
create index if not exists project_documents_customer_id_idx on public.project_documents(customer_id);
create index if not exists service_requests_customer_id_idx on public.service_requests(customer_id);
create index if not exists notifications_customer_id_idx on public.notifications(customer_id);
create index if not exists quotations_customer_id_idx on public.quotations(customer_id);


-- ============================================================
-- TW&D WORKER + ATTENDANCE + PAYROLL + REPORTING
-- ============================================================

create table if not exists public.workers (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_code text unique not null,
  bank_name text,
  account_name text,
  account_number text,
  job_title text,
  department text,
  employment_status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_codes (
  id uuid primary key default gen_random_uuid(),
  work_date date not null default current_date,
  code text not null,
  generated_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(work_date, code)
);

create table if not exists public.worker_attendance (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null default current_date,
  attendance_code_id uuid references public.attendance_codes(id) on delete set null,
  check_in timestamptz not null default now(),
  check_out timestamptz,
  status text not null default 'PRESENT',
  created_at timestamptz not null default now(),
  unique(worker_id, work_date)
);

create table if not exists public.worker_reports (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null default current_date,
  report_title text not null,
  report_body text not null,
  attachment_path text,
  status text not null default 'SUBMITTED',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_payments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references auth.users(id) on delete cascade,
  pay_period text not null,
  amount numeric(15,2) not null default 0,
  currency text not null default 'NGN',
  status text not null default 'PENDING',
  payment_date date,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.workers enable row level security;
alter table public.attendance_codes enable row level security;
alter table public.worker_attendance enable row level security;
alter table public.worker_reports enable row level security;
alter table public.worker_payments enable row level security;

drop policy if exists "Workers can view own worker profile" on public.workers;
create policy "Workers can view own worker profile"
on public.workers for select to authenticated
using(id=auth.uid() or public.is_admin());

drop policy if exists "Admins can manage workers" on public.workers;
create policy "Admins can manage workers"
on public.workers for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Workers can view active attendance codes" on public.attendance_codes;
drop policy if exists "Workers can read attendance codes" on public.attendance_codes;

drop policy if exists "Admins can manage attendance codes" on public.attendance_codes;
create policy "Admins can manage attendance codes"
on public.attendance_codes for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Workers can manage own attendance" on public.worker_attendance;
create policy "Workers can manage own attendance"
on public.worker_attendance for select to authenticated
using(worker_id=auth.uid() or public.is_admin());

drop policy if exists "Workers can check in" on public.worker_attendance;
create policy "Workers can check in"
on public.worker_attendance for insert to authenticated
with check(worker_id=auth.uid());

drop policy if exists "Admins can manage attendance" on public.worker_attendance;
create policy "Admins can manage attendance"
on public.worker_attendance for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Workers can view own reports" on public.worker_reports;
create policy "Workers can view own reports"
on public.worker_reports for select to authenticated
using(worker_id=auth.uid() or public.is_admin());

drop policy if exists "Workers can submit reports" on public.worker_reports;
create policy "Workers can submit reports"
on public.worker_reports for insert to authenticated
with check(worker_id=auth.uid());

drop policy if exists "Admins can manage worker reports" on public.worker_reports;
create policy "Admins can manage worker reports"
on public.worker_reports for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Workers can view own payments" on public.worker_payments;
create policy "Workers can view own payments"
on public.worker_payments for select to authenticated
using(worker_id=auth.uid() or public.is_admin());

drop policy if exists "Admins can manage worker payments" on public.worker_payments;
create policy "Admins can manage worker payments"
on public.worker_payments for all to authenticated
using(public.is_admin()) with check(public.is_admin());

create index if not exists workers_employee_code_idx on public.workers(employee_code);
create index if not exists attendance_codes_date_idx on public.attendance_codes(work_date);
create index if not exists worker_attendance_worker_date_idx on public.worker_attendance(worker_id,work_date);
create index if not exists worker_reports_worker_date_idx on public.worker_reports(worker_id,report_date);
create index if not exists worker_payments_worker_period_idx on public.worker_payments(worker_id,pay_period);


create or replace function public.worker_check_in(p_code text)
returns json
language plpgsql
security definer
set search_path=public
as $$
declare
  code_row public.attendance_codes%rowtype;
  existing public.worker_attendance%rowtype;
begin
  if not exists(select 1 from public.workers where id=auth.uid() and employment_status='ACTIVE') then
    raise exception 'Worker account is not active.';
  end if;

  select * into code_row
  from public.attendance_codes
  where code=upper(trim(p_code))
    and work_date=current_date
    and expires_at>now()
  order by created_at desc
  limit 1;

  if code_row.id is null then
    raise exception 'Invalid or expired attendance code.';
  end if;

  select * into existing from public.worker_attendance
  where worker_id=auth.uid() and work_date=current_date;

  if existing.id is not null then
    return json_build_object('ok',true,'message','Attendance already recorded for today.','check_in',existing.check_in);
  end if;

  insert into public.worker_attendance(worker_id,work_date,attendance_code_id,check_in,status)
  values(auth.uid(),current_date,code_row.id,now(),'PRESENT');

  return json_build_object('ok',true,'message','Check-in recorded successfully.','check_in',now());
end;
$$;

revoke all on function public.worker_check_in(text) from public;
grant execute on function public.worker_check_in(text) to authenticated;

create or replace function public.worker_check_out()
returns json
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.worker_attendance%rowtype;
begin
  update public.worker_attendance
  set check_out=now(), status='COMPLETED'
  where worker_id=auth.uid() and work_date=current_date and check_out is null
  returning * into a;
  if a.id is null then raise exception 'No open attendance record was found for today.'; end if;
  return json_build_object('ok',true,'message','Check-out recorded successfully.','check_out',a.check_out);
end;
$$;

revoke all on function public.worker_check_out() from public;
grant execute on function public.worker_check_out() to authenticated;

create or replace function public.admin_generate_attendance_code()
returns text
language plpgsql
security definer
set search_path=public
as $$
declare c text;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  c := upper(substr(encode(gen_random_bytes(5),'hex'),1,8));
  insert into public.attendance_codes(work_date,code,generated_by,expires_at)
  values(current_date,c,auth.uid(),now()+interval '12 hours');
  return c;
end;
$$;

revoke all on function public.admin_generate_attendance_code() from public;
grant execute on function public.admin_generate_attendance_code() to authenticated;


alter table public.profiles add column if not exists email text;
update public.profiles p set email=u.email from auth.users u where u.id=p.id and (p.email is null or p.email<>u.email);
