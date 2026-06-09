-- =============================================================================
-- Migration 0004 : notifier les admins quand une fiche passe en SOUMISE
-- =============================================================================
-- Mise à jour de la fonction transition_fiche pour insérer une notification
-- à destination de tous les ADMINs de l'organisation lorsqu'une fiche est
-- soumise par un prospecteur (BROUILLON → SOUMISE).
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
  v_uid     uuid := auth.uid();
  v_role    public.user_role;
  v_org     uuid;
  v_fiche      public.fiches;
  v_old_status public.fiche_status;
  v_allowed    boolean := false;
  v_action     text;
  v_admin_id   uuid;
begin
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;

  -- Profil appelant
  select role, organization_id into v_role, v_org
  from public.profiles where id = v_uid;
  if v_org is null then
    raise exception 'Profil introuvable';
  end if;

  -- Fiche cible (verrouillée le temps de la transaction)
  select * into v_fiche from public.fiches where id = p_fiche_id for update;
  if not found then
    raise exception 'Fiche introuvable';
  end if;
  if v_fiche.organization_id <> v_org then
    raise exception 'Fiche hors de votre organisation';
  end if;

  -- ── Matrice de transitions ─────────────────────────────────────────────────
  v_allowed := case
    when v_fiche.status = 'BROUILLON' and p_new_status = 'SOUMISE'
      then v_role in ('PROSPECTEUR', 'COMMERCIAL', 'ADMIN')
    when v_fiche.status = 'SOUMISE'  and p_new_status = 'AFFECTEE' then v_role = 'ADMIN'
    when v_fiche.status = 'SOUMISE'  and p_new_status = 'BROUILLON' then v_role = 'ADMIN'
    when v_fiche.status = 'AFFECTEE' and p_new_status in ('ACCEPTEE', 'REFUSEE')
      then v_role in ('ADMIN', 'COMMERCIAL')
    when v_fiche.status = 'AFFECTEE' and p_new_status = 'SOUMISE' then v_role = 'ADMIN'
    when v_fiche.status = 'ACCEPTEE' and p_new_status = 'ARCHIVEE' then v_role = 'ADMIN'
    when v_fiche.status = 'REFUSEE'  and p_new_status = 'ARCHIVEE' then v_role = 'ADMIN'
    when v_fiche.status = 'REFUSEE'  and p_new_status = 'AFFECTEE' then v_role = 'ADMIN'
    else false
  end;

  if not v_allowed then
    raise exception 'Transition % → % non autorisée pour le rôle %',
      v_fiche.status, p_new_status, v_role;
  end if;

  -- Affectation : commercial cible obligatoire et dans la même organisation
  if p_new_status = 'AFFECTEE' then
    if p_assigned_to is null then
      raise exception 'Un commercial doit être désigné pour affecter la fiche';
    end if;
    if not exists (
      select 1 from public.profiles
      where id = p_assigned_to and organization_id = v_org
    ) then
      raise exception 'Commercial cible invalide';
    end if;
  end if;

  -- ── Écriture atomique ──────────────────────────────────────────────────────
  v_old_status := v_fiche.status;

  update public.fiches
  set status      = p_new_status,
      assigned_to = case when p_new_status = 'AFFECTEE' then p_assigned_to else assigned_to end,
      consentement_rgpd = case when p_new_status = 'SOUMISE' then true else consentement_rgpd end
  where id = p_fiche_id
  returning * into v_fiche;

  v_action := 'Statut : ' || v_old_status || ' → ' || p_new_status;

  insert into public.fiche_history (fiche_id, organization_id, user_id, action, old_status, new_status, comment)
  values (p_fiche_id, v_org, v_uid, v_action, v_old_status, p_new_status, p_comment);

  -- ── Notifications ──────────────────────────────────────────────────────────

  -- 1. SOUMISE → notifier tous les ADMINs de l'organisation
  if p_new_status = 'SOUMISE' then
    for v_admin_id in
      select id from public.profiles
      where organization_id = v_org
        and role = 'ADMIN'
        and is_active = true
        and id <> v_uid   -- ne pas notifier l'admin qui soumet lui-même
    loop
      insert into public.notifications (user_id, organization_id, type, title, message, fiche_id)
      values (
        v_admin_id, v_org,
        'FICHE_SOUMISE',
        'Nouvelle fiche à valider',
        'La fiche ' || coalesce(v_fiche.reference, '') || ' a été soumise et attend votre validation.',
        p_fiche_id
      );
    end loop;
  end if;

  -- 2. AFFECTEE → notifier le commercial désigné
  if p_new_status = 'AFFECTEE' and p_assigned_to is not null then
    insert into public.notifications (user_id, organization_id, type, title, message, fiche_id)
    values (
      p_assigned_to, v_org,
      'FICHE_AFFECTEE',
      'Nouvelle fiche affectée',
      'La fiche ' || coalesce(v_fiche.reference, '') || ' vous a été affectée.',
      p_fiche_id
    );
  end if;

  -- 3. ACCEPTEE / REFUSEE → notifier le prospecteur créateur
  if p_new_status in ('ACCEPTEE', 'REFUSEE')
     and v_fiche.created_by is not null
     and v_fiche.created_by <> v_uid then
    insert into public.notifications (user_id, organization_id, type, title, message, fiche_id)
    values (
      v_fiche.created_by, v_org,
      case when p_new_status = 'ACCEPTEE' then 'FICHE_ACCEPTEE' else 'FICHE_REFUSEE' end,
      case when p_new_status = 'ACCEPTEE' then 'Fiche acceptée par le client'
           else 'Fiche refusée par le client' end,
      'Votre fiche ' || coalesce(v_fiche.reference, '') || ' a été '
        || case when p_new_status = 'ACCEPTEE' then 'acceptée' else 'refusée' end || '.',
      p_fiche_id
    );
  end if;

  return v_fiche;
end;
$$;

-- Permissions inchangées
revoke all on function public.transition_fiche(uuid, public.fiche_status, text, uuid) from public;
grant execute on function public.transition_fiche(uuid, public.fiche_status, text, uuid) to authenticated;
