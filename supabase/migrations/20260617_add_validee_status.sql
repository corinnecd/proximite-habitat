-- Add VALIDEE to the fiche_status enum (between SOUMISE and AFFECTEE)
ALTER TYPE public.fiche_status ADD VALUE IF NOT EXISTS 'VALIDEE' AFTER 'SOUMISE';

-- Update transition_fiche to handle VALIDEE
create or replace function public.transition_fiche(
  p_fiche_id     uuid,
  p_new_status   public.fiche_status,
  p_comment      text default null,
  p_assigned_to  uuid default null
)
returns public.fiches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_role         public.user_role;
  v_org          uuid;
  v_fiche        public.fiches;
  v_old_status   public.fiche_status;
  v_allowed      boolean := false;
  v_admin_id     uuid;
  v_ventes_count integer;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;

  select role, organization_id into v_role, v_org
  from public.profiles where id = v_uid;
  if v_org is null then raise exception 'Profil introuvable'; end if;

  select * into v_fiche from public.fiches where id = p_fiche_id for update;
  if not found then raise exception 'Fiche introuvable'; end if;
  if v_fiche.organization_id <> v_org then raise exception 'Fiche hors de votre organisation'; end if;

  v_allowed := case
    when v_fiche.status = 'BROUILLON' and p_new_status = 'SOUMISE'
      then v_role in ('PROSPECTEUR', 'COMMERCIAL', 'ADMIN')
    when v_fiche.status = 'SOUMISE'  and p_new_status = 'VALIDEE'   then v_role = 'ADMIN'
    when v_fiche.status = 'SOUMISE'  and p_new_status = 'BROUILLON' then v_role = 'ADMIN'
    when v_fiche.status = 'VALIDEE'  and p_new_status = 'AFFECTEE'  then v_role = 'ADMIN'
    when v_fiche.status = 'VALIDEE'  and p_new_status = 'SOUMISE'   then v_role = 'ADMIN'
    when v_fiche.status = 'AFFECTEE' and p_new_status in ('RETRACTATION', 'ACCEPTEE', 'REFUSEE', 'ARCHIVEE')
      then v_role in ('ADMIN', 'COMMERCIAL')
    when v_fiche.status = 'AFFECTEE' and p_new_status = 'SOUMISE'   then v_role = 'ADMIN'
    when v_fiche.status = 'RETRACTATION' and p_new_status in ('ACCEPTEE', 'REFUSEE', 'ARCHIVEE')
      then v_role in ('ADMIN', 'COMMERCIAL')
    when v_fiche.status = 'RETRACTATION' and p_new_status = 'AFFECTEE' then v_role = 'ADMIN'
    when v_fiche.status = 'ACCEPTEE' and p_new_status = 'ARCHIVEE'  then v_role = 'ADMIN'
    when v_fiche.status = 'REFUSEE'  and p_new_status = 'ARCHIVEE'  then v_role = 'ADMIN'
    when v_fiche.status = 'REFUSEE'  and p_new_status = 'AFFECTEE'  then v_role = 'ADMIN'
    else false
  end;
  if not v_allowed then
    raise exception 'Transition % → % non autorisée pour le rôle %',
      v_fiche.status, p_new_status, v_role;
  end if;

  if p_new_status = 'AFFECTEE' then
    if p_assigned_to is null then raise exception 'Un commercial doit être désigné'; end if;
    if not exists (select 1 from public.profiles where id = p_assigned_to and organization_id = v_org) then
      raise exception 'Commercial cible invalide';
    end if;
  end if;

  v_old_status := v_fiche.status;
  update public.fiches
  set status = p_new_status,
      assigned_to = case when p_new_status = 'AFFECTEE' then p_assigned_to else assigned_to end,
      updated_at = now()
  where id = p_fiche_id
  returning * into v_fiche;

  insert into public.fiche_history (fiche_id, user_id, organization_id, action, old_status, new_status, comment)
  values (p_fiche_id, v_uid, v_org, 'STATUS_CHANGE', v_old_status, p_new_status, p_comment);

  -- Delete processed notifications
  delete from public.notifications
  where fiche_id = p_fiche_id
    and type in ('FICHE_SOUMISE', 'FICHE_AFFECTEE', 'FICHE_RETRACTATION');

  -- Create notification for prospecteur when fiche is validated
  if p_new_status = 'VALIDEE' then
    insert into public.notifications (user_id, organization_id, fiche_id, type, title, message)
    values (v_fiche.created_by, v_org, p_fiche_id, 'FICHE_AFFECTEE', 'Fiche validée',
            'Votre fiche ' || v_fiche.reference || ' a été validée par la direction.');
  end if;

  if p_new_status = 'AFFECTEE' then
    insert into public.notifications (user_id, organization_id, fiche_id, type, title, message)
    values (v_fiche.created_by, v_org, p_fiche_id, 'FICHE_AFFECTEE', 'Fiche affectée',
            'Votre fiche ' || v_fiche.reference || ' a été affectée à un commercial.');
    if p_assigned_to is not null then
      insert into public.notifications (user_id, organization_id, fiche_id, type, title, message)
      values (p_assigned_to, v_org, p_fiche_id, 'FICHE_AFFECTEE', 'Nouvelle fiche affectée',
              'La fiche ' || v_fiche.reference || ' vous a été affectée.');
    end if;
  end if;

  if p_new_status in ('ACCEPTEE', 'REFUSEE') then
    select id into v_admin_id from public.profiles
    where organization_id = v_org and role = 'ADMIN' limit 1;
    if v_admin_id is not null then
      insert into public.notifications (user_id, organization_id, fiche_id, type, title, message)
      values (v_admin_id, v_org, p_fiche_id,
              case when p_new_status = 'ACCEPTEE' then 'FICHE_ACCEPTEE' else 'FICHE_REFUSEE' end,
              case when p_new_status = 'ACCEPTEE' then 'Acceptation client' else 'Refus client' end,
              'La fiche ' || v_fiche.reference || case when p_new_status = 'ACCEPTEE' then ' a été acceptée par le client.' else ' a été refusée par le client.' end);
    end if;
  end if;

  return v_fiche;
end;
$$;

revoke all on function public.transition_fiche(uuid, public.fiche_status, text, uuid) from public;
grant execute on function public.transition_fiche(uuid, public.fiche_status, text, uuid) to authenticated;
