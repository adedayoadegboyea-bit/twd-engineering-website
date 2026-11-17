begin;

-- Public homepage totals. Private project and worker table policies stay in force.
-- Current projects include all open records. Ongoing projects are the subset
-- assigned to design, approval or delivery. Counts cover the website database.
create or replace function public.homepage_activity_totals()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with project_statuses as (
    select pg_catalog.upper(pg_catalog.btrim(status)) as stage
    from public.projects
  )
  select pg_catalog.jsonb_build_object(
    'current_projects', count(*) filter (
      where stage not in ('COMPLETED', 'CANCELLED', 'CANCELED', 'ARCHIVED',
                          'CLOSED', 'REJECTED', 'INACTIVE')
    ),
    'completed_projects', count(*) filter (where stage = 'COMPLETED'),
    'ongoing_projects', count(*) filter (
      where stage in ('DESIGN', 'APPROVAL', 'FOUNDATION', 'STRUCTURE', 'ROOFING',
                      'FINISHING', 'IN_PROGRESS', 'ONGOING', 'CONSTRUCTION')
    ),
    'active_workers', (
      select count(*) from public.workers
      where pg_catalog.upper(pg_catalog.btrim(employment_status)) = 'ACTIVE'
    ),
    'checked_at', pg_catalog.statement_timestamp()
  )
  from project_statuses;
$$;

revoke all on function public.homepage_activity_totals() from public, anon, authenticated;
grant execute on function public.homepage_activity_totals() to anon, authenticated;
notify pgrst, 'reload schema';

commit;
