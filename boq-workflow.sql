-- Controlled customer action: submit a saved draft for TW&D review.
create or replace function public.submit_boq_for_approval(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.boq_projects%rowtype;
begin
  select * into p from public.boq_projects
  where id = p_project_id and created_by = auth.uid()
  for update;
  if p.id is null then
    raise exception 'Estimate not found or access denied.';
  end if;
  if p.status not in ('DRAFT','CHANGES_REQUESTED') then
    raise exception 'Only drafts or estimates returned for changes can be submitted.';
  end if;
  if not exists (select 1 from public.boq_items where project_id = p_project_id) then
    raise exception 'Add at least one BOQ line before submitting.';
  end if;
  update public.boq_projects
  set status='PENDING_APPROVAL', updated_at=now()
  where id=p_project_id;
  return jsonb_build_object('ok',true,'status','PENDING_APPROVAL');
end;
$$;
revoke all on function public.submit_boq_for_approval(uuid) from public;
grant execute on function public.submit_boq_for_approval(uuid) to authenticated;
