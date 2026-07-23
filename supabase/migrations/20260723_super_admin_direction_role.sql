-- =============================================================================
-- Migration : Ajout du rôle SUPER_ADMIN et renommage ADMIN → DIRECTION
-- SUPER_ADMIN = administration du site (gestion utilisateurs, organisations)
-- DIRECTION   = direction de succursale (fiches, reporting, équipe)
-- =============================================================================

-- 1. Ajout des nouvelles valeurs à l'enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'DIRECTION';

-- 2. Renommer tous les profils ADMIN → DIRECTION
UPDATE public.profiles SET role = 'DIRECTION' WHERE role = 'ADMIN';

-- 3. corinnediarra.cd@gmail.com → SUPER_ADMIN
UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE email = 'corinnediarra.cd@gmail.com';

-- =============================================================================
-- 4. Recréer transition_fiche avec DIRECTION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.transition_fiche(
  p_fiche_id     uuid,
  p_new_status   public.fiche_status,
  p_comment      text default null,
  p_assigned_to  uuid default null
)
RETURNS public.fiches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_role         public.user_role;
  v_org          uuid;
  v_fiche        public.fiches;
  v_old_status   public.fiche_status;
  v_allowed      boolean := false;
  v_admin_id     uuid;
  v_ventes_count integer;
  v_date_heure   text;
  v_commercial_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  SELECT role, organization_id INTO v_role, v_org
  FROM public.profiles WHERE id = v_uid;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Profil introuvable'; END IF;

  SELECT * INTO v_fiche FROM public.fiches WHERE id = p_fiche_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fiche introuvable'; END IF;
  IF v_fiche.organization_id <> v_org THEN RAISE EXCEPTION 'Fiche hors de votre organisation'; END IF;

  v_allowed := CASE
    WHEN v_fiche.status = 'BROUILLON'         AND p_new_status = 'SOUMISE'
      THEN v_role IN ('PROSPECTEUR', 'CHEF_EQUIPE', 'COMMERCIAL', 'DIRECTION')
    WHEN v_fiche.status = 'SOUMISE'           AND p_new_status = 'VALIDEE'
      THEN v_role = 'DIRECTION'
    WHEN v_fiche.status = 'SOUMISE'           AND p_new_status = 'BROUILLON'
      THEN v_role IN ('DIRECTION', 'PROSPECTEUR', 'CHEF_EQUIPE')
    WHEN v_fiche.status = 'VALIDEE'           AND p_new_status = 'AFFECTEE'
      THEN v_role = 'DIRECTION'
    WHEN v_fiche.status = 'VALIDEE'           AND p_new_status = 'SOUMISE'
      THEN v_role = 'DIRECTION'
    WHEN v_fiche.status = 'AFFECTEE'          AND p_new_status = 'RETRACTATION'
      THEN v_role IN ('DIRECTION', 'COMMERCIAL')
    WHEN v_fiche.status = 'AFFECTEE'          AND p_new_status = 'ACCEPTEE'
      THEN v_role IN ('DIRECTION', 'COMMERCIAL')
    WHEN v_fiche.status = 'AFFECTEE'          AND p_new_status = 'REFUSEE'
      THEN v_role IN ('DIRECTION', 'COMMERCIAL', 'PROSPECTEUR', 'CHEF_EQUIPE')
    WHEN v_fiche.status = 'AFFECTEE'          AND p_new_status = 'ARCHIVEE'
      THEN v_role IN ('DIRECTION', 'COMMERCIAL')
    WHEN v_fiche.status = 'AFFECTEE'          AND p_new_status = 'SOUMISE'
      THEN v_role = 'DIRECTION'
    WHEN v_fiche.status = 'AFFECTEE'          AND p_new_status = 'RDV_A_REPRENDRE'
      THEN v_role IN ('DIRECTION', 'COMMERCIAL')
    WHEN v_fiche.status = 'RDV_A_REPRENDRE'   AND p_new_status = 'AFFECTEE'
      THEN v_role IN ('DIRECTION', 'PROSPECTEUR', 'CHEF_EQUIPE')
    WHEN v_fiche.status = 'RETRACTATION'      AND p_new_status = 'ACCEPTEE'
      THEN v_role IN ('DIRECTION', 'COMMERCIAL')
    WHEN v_fiche.status = 'RETRACTATION'      AND p_new_status = 'REFUSEE'
      THEN v_role IN ('DIRECTION', 'COMMERCIAL', 'PROSPECTEUR', 'CHEF_EQUIPE')
    WHEN v_fiche.status = 'RETRACTATION'      AND p_new_status = 'ARCHIVEE'
      THEN v_role IN ('DIRECTION', 'COMMERCIAL')
    WHEN v_fiche.status = 'RETRACTATION'      AND p_new_status = 'AFFECTEE'
      THEN v_role = 'DIRECTION'
    WHEN v_fiche.status = 'ACCEPTEE'          AND p_new_status = 'ARCHIVEE'
      THEN v_role IN ('DIRECTION', 'COMMERCIAL')
    WHEN v_fiche.status = 'REFUSEE'           AND p_new_status = 'ARCHIVEE'
      THEN v_role IN ('DIRECTION', 'COMMERCIAL')
    WHEN v_fiche.status = 'REFUSEE'           AND p_new_status = 'AFFECTEE'
      THEN v_role = 'DIRECTION'
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition % → % non autorisée pour le rôle %',
      v_fiche.status, p_new_status, v_role;
  END IF;

  IF p_new_status = 'AFFECTEE' THEN
    IF p_assigned_to IS NULL AND v_fiche.assigned_to IS NULL THEN
      RAISE EXCEPTION 'Un commercial doit être désigné';
    END IF;
    IF p_assigned_to IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = p_assigned_to AND organization_id = v_org
    ) THEN RAISE EXCEPTION 'Commercial cible invalide'; END IF;
  END IF;

  v_old_status := v_fiche.status;
  v_date_heure := to_char(now() AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY à HH24:MI');
  v_commercial_id := coalesce(p_assigned_to, v_fiche.assigned_to);

  UPDATE public.fiches
  SET status      = p_new_status,
      assigned_to = CASE WHEN p_new_status = 'AFFECTEE' THEN v_commercial_id ELSE assigned_to END,
      updated_at  = now()
  WHERE id = p_fiche_id
  RETURNING * INTO v_fiche;

  INSERT INTO public.fiche_history (fiche_id, organization_id, user_id, action, old_status, new_status, comment)
  VALUES (p_fiche_id, v_org, v_uid,
    'Statut : ' || v_old_status || ' → ' || p_new_status, v_old_status, p_new_status, p_comment);

  -- SOUMISE → notifier les DIRECTION
  IF p_new_status = 'SOUMISE' THEN
    FOR v_admin_id IN
      SELECT id FROM public.profiles
      WHERE organization_id = v_org AND role = 'DIRECTION' AND is_active = true AND id <> v_uid
    LOOP
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
      VALUES (v_admin_id, v_org, 'FICHE_SOUMISE', 'Nouvelle fiche à valider',
        'La fiche ' || coalesce(v_fiche.reference, '') || ' a été soumise et attend votre validation.',
        p_fiche_id);
    END LOOP;
  END IF;

  IF p_new_status = 'VALIDEE' AND v_fiche.created_by IS NOT NULL AND v_fiche.created_by <> v_uid THEN
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
    VALUES (v_fiche.created_by, v_org, 'FICHE_VALIDEE', 'Fiche validée',
      'Votre fiche ' || coalesce(v_fiche.reference, '') ||
      ' a été validée par la direction le ' || v_date_heure || '.',
      p_fiche_id);
  END IF;

  IF p_new_status = 'AFFECTEE' THEN
    DELETE FROM public.notifications WHERE fiche_id = p_fiche_id AND type = 'FICHE_AFFECTEE';
    IF v_commercial_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
      VALUES (v_commercial_id, v_org, 'FICHE_AFFECTEE',
        CASE WHEN v_old_status = 'RDV_A_REPRENDRE' THEN 'Nouveau RDV à honorer' ELSE 'Nouvelle fiche affectée' END,
        CASE WHEN v_old_status = 'RDV_A_REPRENDRE'
          THEN 'Le référent a fixé un nouveau rendez-vous pour la fiche ' || coalesce(v_fiche.reference, '') || '.'
          ELSE 'La fiche ' || coalesce(v_fiche.reference, '') || ' vous a été affectée le ' || v_date_heure || '.'
        END,
        p_fiche_id);
    END IF;
    IF v_old_status <> 'RDV_A_REPRENDRE' AND v_fiche.created_by IS NOT NULL AND v_fiche.created_by <> v_uid THEN
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
      VALUES (v_fiche.created_by, v_org, 'FICHE_VALIDEE', 'Votre fiche a été affectée',
        'Votre fiche ' || coalesce(v_fiche.reference, '') ||
        ' a été affectée à un commercial le ' || v_date_heure || '.',
        p_fiche_id);
    END IF;
  END IF;

  IF p_new_status = 'RDV_A_REPRENDRE' AND v_fiche.created_by IS NOT NULL AND v_fiche.created_by <> v_uid THEN
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
    VALUES (v_fiche.created_by, v_org, 'CLIENT_ABSENT', 'Client absent — RDV à reprendre',
      'Le client de la fiche ' || coalesce(v_fiche.reference, '') ||
      ' était absent lors de la visite du ' || v_date_heure || '. Veuillez fixer un nouveau rendez-vous.',
      p_fiche_id);
  END IF;

  IF p_new_status IN ('ACCEPTEE', 'REFUSEE') AND v_old_status = 'AFFECTEE' THEN
    DELETE FROM public.notifications WHERE fiche_id = p_fiche_id AND type = 'FICHE_AFFECTEE';
  END IF;

  IF p_new_status = 'ACCEPTEE' AND v_fiche.created_by IS NOT NULL AND v_fiche.created_by <> v_uid THEN
    SELECT count(*) INTO v_ventes_count
    FROM public.fiches
    WHERE created_by = v_fiche.created_by AND status = 'ACCEPTEE' AND organization_id = v_org;

    INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
    VALUES (v_fiche.created_by, v_org, 'VENTE_REALISEE', 'Vente réalisée !',
      'Votre fiche ' || coalesce(v_fiche.reference, '') ||
      ' a abouti à une vente le ' || v_date_heure || '. Total : ' || v_ventes_count || ' vente(s).',
      p_fiche_id);

    IF v_ventes_count > 0 AND (v_ventes_count % 3) = 0 THEN
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
      VALUES (v_fiche.created_by, v_org, 'PRIME_DEBLOQUEE', 'Prime exceptionnelle débloquée !',
        'Félicitations ! Vous avez atteint ' || v_ventes_count ||
        ' ventes. Une prime exceptionnelle vous est due.',
        p_fiche_id);
    END IF;
  END IF;

  IF p_new_status = 'REFUSEE' AND v_fiche.created_by IS NOT NULL AND v_fiche.created_by <> v_uid THEN
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
    VALUES (v_fiche.created_by, v_org, 'FICHE_REFUSEE', 'Fiche refusée',
      'Votre fiche ' || coalesce(v_fiche.reference, '') || ' a été refusée le ' || v_date_heure || '.',
      p_fiche_id);
  END IF;

  RETURN v_fiche;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_fiche(uuid, public.fiche_status, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.transition_fiche(uuid, public.fiche_status, text, uuid) TO authenticated;

-- =============================================================================
-- 5. Recréer le trigger de notification soumission
-- =============================================================================
CREATE OR REPLACE FUNCTION public.notify_admins_on_soumise()
RETURNS trigger AS $$
DECLARE
  v_role public.user_role;
  v_admin record;
BEGIN
  IF NEW.status = 'SOUMISE' AND (OLD.status IS NULL OR OLD.status <> 'SOUMISE') THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

    FOR v_admin IN
      SELECT id FROM public.profiles
      WHERE organization_id = NEW.organization_id
        AND role = 'DIRECTION'
        AND is_active = true
        AND id <> auth.uid()
    LOOP
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
      VALUES (
        v_admin.id,
        NEW.organization_id,
        'FICHE_SOUMISE',
        'Nouvelle fiche soumise',
        'La fiche ' || NEW.reference || ' a été soumise et attend votre validation.',
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. Mettre à jour les RLS policies (ADMIN → DIRECTION)
-- =============================================================================

-- ─── PROFILES ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (public.app_role() IN ('DIRECTION', 'SUPER_ADMIN') AND organization_id = public.app_org_id())
    OR (public.app_role() = 'DIRECTION_GENERALE' AND organization_id IN (SELECT public.app_company_org_ids()))
  )
  WITH CHECK (
    id = auth.uid()
    OR (public.app_role() IN ('DIRECTION', 'SUPER_ADMIN') AND organization_id = public.app_org_id())
    OR (public.app_role() = 'DIRECTION_GENERALE' AND organization_id IN (SELECT public.app_company_org_ids()))
  );

DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.app_role() IN ('DIRECTION', 'SUPER_ADMIN') AND organization_id = public.app_org_id())
    OR (public.app_role() = 'DIRECTION_GENERALE' AND organization_id IN (SELECT public.app_company_org_ids()))
  );

-- ─── FICHES ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS fiches_select ON public.fiches;
CREATE POLICY fiches_select ON public.fiches
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = public.app_org_id()
      AND (
        public.app_role() IN ('DIRECTION', 'SUPER_ADMIN', 'COMMERCIAL')
        OR created_by = auth.uid()
        OR assigned_to = auth.uid()
      )
    )
    OR (public.app_role() = 'DIRECTION_GENERALE' AND organization_id IN (SELECT public.app_company_org_ids()))
  );

DROP POLICY IF EXISTS fiches_update ON public.fiches;
CREATE POLICY fiches_update ON public.fiches
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() <> 'DIRECTION_GENERALE'
    AND (
      public.app_role() IN ('DIRECTION', 'SUPER_ADMIN')
      OR (public.app_role() = 'COMMERCIAL' AND assigned_to = auth.uid())
      OR (public.app_role() = 'PROSPECTEUR' AND created_by = auth.uid())
    )
  )
  WITH CHECK (organization_id = public.app_org_id());

DROP POLICY IF EXISTS fiches_delete ON public.fiches;
CREATE POLICY fiches_delete ON public.fiches
  FOR DELETE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() <> 'DIRECTION_GENERALE'
    AND (
      public.app_role() IN ('DIRECTION', 'SUPER_ADMIN')
      OR (created_by = auth.uid() AND status = 'BROUILLON')
    )
  );

-- ─── PARCOURS_HEBDO ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS parcours_hebdo_insert ON public.parcours_hebdo;
CREATE POLICY parcours_hebdo_insert ON public.parcours_hebdo
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('DIRECTION', 'SUPER_ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

DROP POLICY IF EXISTS parcours_hebdo_update ON public.parcours_hebdo;
CREATE POLICY parcours_hebdo_update ON public.parcours_hebdo
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('DIRECTION', 'SUPER_ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  )
  WITH CHECK (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('DIRECTION', 'SUPER_ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

DROP POLICY IF EXISTS parcours_hebdo_delete ON public.parcours_hebdo;
CREATE POLICY parcours_hebdo_delete ON public.parcours_hebdo
  FOR DELETE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('DIRECTION', 'SUPER_ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

-- ─── PLANIFICATION_HEBDO ───────────────────────────────────────────────────
DROP POLICY IF EXISTS planification_hebdo_insert ON public.planification_hebdo;
CREATE POLICY planification_hebdo_insert ON public.planification_hebdo
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('DIRECTION', 'SUPER_ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

DROP POLICY IF EXISTS planification_hebdo_update ON public.planification_hebdo;
CREATE POLICY planification_hebdo_update ON public.planification_hebdo
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('DIRECTION', 'SUPER_ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

DROP POLICY IF EXISTS planification_hebdo_delete ON public.planification_hebdo;
CREATE POLICY planification_hebdo_delete ON public.planification_hebdo
  FOR DELETE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('DIRECTION', 'SUPER_ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

-- ─── OBJECTIFS_COMMERCIAUX ─────────────────────────────────────────────────
DROP POLICY IF EXISTS objectifs_select_admin ON public.objectifs_commerciaux;
CREATE POLICY objectifs_select_admin ON public.objectifs_commerciaux
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('DIRECTION', 'SUPER_ADMIN', 'DIRECTION_GENERALE')
    )
  );

DROP POLICY IF EXISTS objectifs_insert_admin ON public.objectifs_commerciaux;
CREATE POLICY objectifs_insert_admin ON public.objectifs_commerciaux
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('DIRECTION', 'SUPER_ADMIN', 'DIRECTION_GENERALE')
    )
  );

DROP POLICY IF EXISTS objectifs_update_admin ON public.objectifs_commerciaux;
CREATE POLICY objectifs_update_admin ON public.objectifs_commerciaux
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('DIRECTION', 'SUPER_ADMIN', 'DIRECTION_GENERALE')
    )
  );

DROP POLICY IF EXISTS objectifs_delete_admin ON public.objectifs_commerciaux;
CREATE POLICY objectifs_delete_admin ON public.objectifs_commerciaux
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('DIRECTION', 'SUPER_ADMIN', 'DIRECTION_GENERALE')
    )
  );
