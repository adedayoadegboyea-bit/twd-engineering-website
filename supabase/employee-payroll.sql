-- TW&D employee portal. Execute in Supabase SQL editor after reviewing.
-- Employee accounts use Supabase Auth. A company administrator must link each employee.
create table if not exists public.employee_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 employee_code text unique,
 full_name text not null,
 job_title text,
 department text,
 hire_date date,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.payroll_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.salary_payments (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.employee_profiles(user_id) on delete cascade,
 pay_period date not null,
 gross_amount numeric(14,2) not null check(gross_amount>=0),
 deductions numeric(14,2) not null default 0 check(deductions>=0),
 net_amount numeric(14,2) generated always as (gross_amount-deductions) stored,
 currency text not null default 'NGN' check(currency='NGN'),
 payment_status text not null default 'pending' check(payment_status in ('pending','processing','paid','failed')),
 paid_at timestamptz,
 payment_reference text,
 notes text,
 created_at timestamptz not null default now(),
 constraint deductions_not_above_gross check(deductions<=gross_amount),
 unique(employee_id,pay_period)
);
create or replace function public.is_payroll_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.payroll_admins where user_id=(select auth.uid())); $$;
revoke all on function public.is_payroll_admin() from public;
grant execute on function public.is_payroll_admin() to authenticated;
alter table public.employee_profiles enable row level security;
alter table public.payroll_admins enable row level security;
alter table public.salary_payments enable row level security;
revoke all on public.employee_profiles,public.payroll_admins,public.salary_payments from anon;
grant select on public.employee_profiles,public.salary_payments to authenticated;
grant insert,update,delete on public.employee_profiles,public.salary_payments to authenticated;
-- Do not grant payroll_admins read/write access to the browser; grant admins via SQL only.
create policy "Employees see own profile or admins see all" on public.employee_profiles
 for select to authenticated using (user_id=(select auth.uid()) or (select public.is_payroll_admin()));
create policy "Payroll admins insert profiles" on public.employee_profiles
 for insert to authenticated with check ((select public.is_payroll_admin()));
create policy "Payroll admins update profiles" on public.employee_profiles
 for update to authenticated using ((select public.is_payroll_admin())) with check ((select public.is_payroll_admin()));
create policy "Payroll admins delete profiles" on public.employee_profiles
 for delete to authenticated using ((select public.is_payroll_admin()));
create policy "Employees see only own salary or admins see all" on public.salary_payments
 for select to authenticated using (employee_id=(select auth.uid()) or (select public.is_payroll_admin()));
create policy "Payroll admins insert salary" on public.salary_payments
 for insert to authenticated with check ((select public.is_payroll_admin()));
create policy "Payroll admins update salary" on public.salary_payments
 for update to authenticated using ((select public.is_payroll_admin())) with check ((select public.is_payroll_admin()));
create policy "Payroll admins delete salary" on public.salary_payments
 for delete to authenticated using ((select public.is_payroll_admin()));
-- IMPORTANT: payment_status is an admin-entered record, not evidence of a bank transfer.
-- Add an admin by inserting their verified auth.users UUID in payroll_admins via SQL editor.
