-- =============================================================================
-- Migration : une seule notification référent lors de validation + affectation
-- SOUMISE → VALIDEE : aucune notification au référent (l'affectation suit)
-- VALIDEE → AFFECTEE : une seule notification combinée au référent
-- =============================================================================

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
  v_date_heure   text;
  v_comm_name    text;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;

  select role, organization_id into v_role, v_org
  from public.profiles where id = v_uid;
  if v_org is null then raise exception 'Profil introuvable'; end if;

  select * into v_fiche from public.fiches where id = p_fiche_id for update;
  if not found then raise exception 'Fiche introuvable'; end if;
  if v_fiche.organization_id <> v_org then raise exception 'Fiche hors de votre organisation'; end if;

  -- ── Matrice de transitions ────────────────────────────────────────────────
  v_allowed := case
    when v_fiche.status = 'BROUILLON'     and p_new_status = 'SOUMISE'
      then v_role in ('PROSPECTEUR', 'CHEF_EQUIPE', 'COMMERCIAL', 'ADMIN')
    when v_fiche.status = 'SOUMISE'       and p_new_status = 'VALIDEE'
      then v_role = 'ADMIN'
    when v_fiche.status = 'SOUMISE'       and p_new_status = 'BROUILLON'
      then v_role in ('ADMIN', 'PROSPECTEUR', 'CHEF_EQUIPE')
    when v_fiche.status = 'VALIDEE'       and p_new_status = 'AFFECTEE'
      then v_role = 'ADMIN'
    when v_fiche.status = 'VALIDEE'       and p_new_status = 'SOUMISE'
      then v_role = 'ADMIN'
    when v_fiche.status = 'AFFECTEE'      and p_new_status = 'RETRACTATION'
      then v_role in ('ADMIN', 'COMMERCIAL')
    when v_fiche.status = 'AFFECTEE'      and p_new_status = 'ACCEPTEE'
      then v_role in ('ADMIN', 'COMMERCIAL')
    when v_fiche.status = 'AFFECTEE'      and p_new_status = 'REFUSEE'
      then v_role in ('ADMIN', 'COMMERCIAL', 'PROSPECTEUR', 'CHEF_EQUIPE')
    when v_fiche.status = 'AFFECTEE'      and p_new_status = 'ARCHIVEE'
      then v_role in ('ADMIN', 'COMMERCIAL')
    when v_fiche.status = 'AFFECTEE'      and p_new_status = 'SOUMISE'
      then v_role = 'ADMIN'
    when v_fiche.status = 'RETRACTATION'  and p_new_status = 'ACCEPTEE'
      then v_role in ('ADMIN', 'COMMERCIAL')
    when v_fiche.status = 'RETRACTATION'  and p_new_status = 'REFUSEE'
      then v_role in ('ADMIN', 'COMMERCIAL', 'PROSPECTEUR', 'CHEF_EQUIPE')
    when v_fiche.status = 'RETRACTATION'  and p_new_status = 'ARCHIVEE'
      then v_role in ('ADMIN', 'COMMERCIAL')
    when v_fiche.status = 'RETRACTATION'  and p_new_status = 'AFFECTEE'
      then v_role = 'ADMIN'
    when v_fiche.status = 'ACCEPTEE'      and p_new_status = 'ARCHIVEE'
      then v_role in ('ADMIN', 'COMMERCIAL')
    when v_fiche.status = 'REFUSEE'       and p_new_status = 'ARCHIVEE'
      then v_role in ('ADMIN', 'COMMERCIAL')
    when v_fiche.status = 'REFUSEE'       and p_new_status = 'AFFECTEE'
      then v_role = 'ADMIN'
    else false
  end;

  if not v_allowed then
    raise exception 'Transition % → % non autorisée pour le rôle %',
      v_fiche.status, p_new_status, v_role;
  end if;

  if p_new_status = 'AFFECTEE' then
    if p_assigned_to is null then raise exception 'Un commercial doit être désigné'; end if;
    if not exists (
      select 1 from public.profiles where id = p_assigned_to and organization_id = v_org
    ) then raise exception 'Commercial cible invalide'; end if;
  end if;

  -- ── Écriture atomique ─────────────────────────────────────────────────────
  v_old_status := v_fiche.status;
  v_date_heure := to_char(now() at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI');

  update public.fiches
  set status      = p_new_status,
      assigned_to = case when p_new_status = 'AFFECTEE' then p_assigned_to else assigned_to end,
      updated_at  = now()
  where id = p_fiche_id
  returning * into v_fiche;

  insert into public.fiche_history (fiche_id, organization_id, user_id, action, old_status, new_status, comment)
  values (p_fiche_id, v_org, v_uid,
    'Statut : ' || v_old_status || ' → ' || p_new_status, v_old_status, p_new_status, p_comment);

  -- ── Notifications ─────────────────────────────────────────────────────────

  -- SOUMISE → notifier les admins uniquement (pas le référent, l'affectation suit)
  if p_new_status = 'SOUMISE' then
    for v_admin_id in
      select id from public.profiles
      where organization_id = v_org and role = 'ADMIN' and is_active = true and id <> v_uid
    loop
      insert into public.notifications (user_id, organization_id, type, title, message, fiche_id)
      values (v_admin_id, v_org, 'FICHE_SOUMISE', 'Nouvelle fiche à valider',
        'La fiche ' || coalesce(v_fiche.reference, '') || ' a été soumise et attend votre validation.',
        p_fiche_id);
    end loop;
  end if;

  -- SOUMISE → VALIDEE : aucune notification au référent
  -- (la notification combinée sera envoyée lors de VALIDEE → AFFECTEE)

  -- AFFECTEE → notifier le commercial + une seule notification combinée au référent
  if p_new_status = 'AFFECTEE' then
    -- Purger toutes les anciennes notifications d'affectation/validation pour cette fiche
    delete from public.notifications
    where fiche_id = p_fiche_id and type in ('FICHE_AFFECTEE', 'FICHE_VALIDEE');

    -- Notification au commercial assigné
    if p_assigned_to is not null then
      insert into public.notifications (user_id, organization_id, type, title, message, fiche_id)
      values (p_assigned_to, v_org, 'FICHE_AFFECTEE', 'Nouvelle fiche affectée',
        'La fiche ' || coalesce(v_fiche.reference, '') || ' vous a été affectée le ' || v_date_heure || '.',
        p_fiche_id);

      -- Récupérer le nom du commercial pour le message au référent
      select first_name || ' ' || last_name into v_comm_name
      from public.profiles where id = p_assigned_to;
    end if;

    -- Notification combinée au référent : fiche validée ET affectée
    if v_fiche.created_by is not null and v_fiche.created_by <> v_uid then
      insert into public.notifications (user_id, organization_id, type, title, message, fiche_id)
      values (
        v_fiche.created_by, v_org,
        'FICHE_AFFECTEE',
        'Fiche validée et affectée',
        'Votre fiche ' || coalesce(v_fiche.reference, '') ||
        ' a été validée par la direction et affectée à ' ||
        coalesce(v_comm_name, 'un commercial') ||
        ' le ' || v_date_heure || '.',
        p_fiche_id
      );
    end if;
  end if;

  -- ACCEPTEE ou REFUSEE → supprimer notif FICHE_AFFECTEE du commercial
  if p_new_status in ('ACCEPTEE', 'REFUSEE') and v_old_status = 'AFFECTEE' then
    delete from public.notifications where fiche_id = p_fiche_id and type = 'FICHE_AFFECTEE';
  end if;

  -- ACCEPTEE → vente + prime éventuelle
  if p_new_status = 'ACCEPTEE' and v_fiche.created_by is not null and v_fiche.created_by <> v_uid then
    select count(*) into v_ventes_count
    from public.fiches
    where created_by = v_fiche.created_by and status = 'ACCEPTEE' and organization_id = v_org;

    insert into public.notifications (user_id, organization_id, type, title, message, fiche_id)
    values (v_fiche.created_by, v_org, 'VENTE_REALISEE', 'Vente réalisée !',
      'Votre fiche ' || coalesce(v_fiche.reference, '') ||
      ' a abouti à une vente le ' || v_date_heure || '. Total : ' || v_ventes_count || ' vente(s).',
      p_fiche_id);

    if v_ventes_count > 0 and (v_ventes_count % 3) = 0 then
      insert into public.notifications (user_id, organization_id, type, title, message, fiche_id)
      values (v_fiche.created_by, v_org, 'PRIME_DEBLOQUEE', 'Prime exceptionnelle débloquée !',
        'Félicitations ! Vous avez atteint ' || v_ventes_count ||
        ' ventes. Une prime exceptionnelle vous est due.',
        p_fiche_id);
    end if;
  end if;

  -- REFUSEE → notifier le prospecteur
  if p_new_status = 'REFUSEE' and v_fiche.created_by is not null and v_fiche.created_by <> v_uid then
    insert into public.notifications (user_id, organization_id, type, title, message, fiche_id)
    values (v_fiche.created_by, v_org, 'FICHE_REFUSEE', 'Fiche refusée',
      'Votre fiche ' || coalesce(v_fiche.reference, '') || ' a été refusée le ' || v_date_heure || '.',
      p_fiche_id);
  end if;

  return v_fiche;
end;
$$;

revoke all on function public.transition_fiche(uuid, public.fiche_status, text, uuid) from public;
grant execute on function public.transition_fiche(uuid, public.fiche_status, text, uuid) to authenticated;
