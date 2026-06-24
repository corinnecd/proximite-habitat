-- =============================================================================
-- Proximité Habitat Conseil — Multi-société / Succursales
-- Migration : table companies, rôle DIRECTION_GENERALE, RLS cross-branch
-- =============================================================================
-- Modèle :
--   * companies  = société mère (groupe)
--   * organizations = succursale (branch) au sein d'une société
--   * DIRECTION_GENERALE = rôle lecture seule cross-succursales
--   * Aucune table de données modifiée, organization_id garde son nom
--   * Tous les rôles existants fonctionnent identiquement
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Nouveau rôle DIRECTION_GENERALE
-- -----------------------------------------------------------------------------
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'DIRECTION_GENERALE';

-- -----------------------------------------------------------------------------
-- 2. Table companies (société mère)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. Lier organizations (succursales) à leur société mère
-- -----------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_hq BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS organizations_company_id_idx
  ON public.organizations(company_id);

-- -----------------------------------------------------------------------------
-- 4. Helpers RLS pour le contexte multi-société
-- -----------------------------------------------------------------------------

-- Retourne le company_id de l'utilisateur courant (via son organization)
CREATE OR REPLACE FUNCTION public.app_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.company_id
  FROM public.profiles p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = auth.uid();
$$;

-- Retourne tous les organization_id de la même société (pour le rôle DG)
CREATE OR REPLACE FUNCTION public.app_company_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id
  FROM public.organizations o
  WHERE o.company_id = public.app_company_id();
$$;

-- =============================================================================
-- 5. Mise à jour des policies RLS
-- =============================================================================
-- Principe : chaque policy existante est remplacée par une version qui,
-- pour DIRECTION_GENERALE, étend la visibilité à toutes les organizations
-- de la même société. Pour les autres rôles, comportement identique.
-- =============================================================================

-- ─── COMPANIES ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.app_company_id());

-- ─── ORGANIZATIONS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id = public.app_org_id()
    OR (public.app_role() = 'DIRECTION_GENERALE' AND id IN (SELECT public.app_company_org_ids()))
  );

-- ─── PROFILES ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR organization_id = public.app_org_id()
    OR (public.app_role() = 'DIRECTION_GENERALE' AND organization_id IN (SELECT public.app_company_org_ids()))
  );

-- DG peut modifier les profils de toutes les succursales (gestion utilisateurs)
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (public.app_role() = 'ADMIN' AND organization_id = public.app_org_id())
    OR (public.app_role() = 'DIRECTION_GENERALE' AND organization_id IN (SELECT public.app_company_org_ids()))
  )
  WITH CHECK (
    id = auth.uid()
    OR (public.app_role() = 'ADMIN' AND organization_id = public.app_org_id())
    OR (public.app_role() = 'DIRECTION_GENERALE' AND organization_id IN (SELECT public.app_company_org_ids()))
  );

-- DG peut créer des utilisateurs dans n'importe quelle succursale de sa société
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.app_role() = 'ADMIN' AND organization_id = public.app_org_id())
    OR (public.app_role() = 'DIRECTION_GENERALE' AND organization_id IN (SELECT public.app_company_org_ids()))
  );

-- ─── FICHES ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS fiches_select ON public.fiches;
CREATE POLICY fiches_select ON public.fiches
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = public.app_org_id()
      AND (
        public.app_role() IN ('ADMIN', 'COMMERCIAL')
        OR created_by = auth.uid()
        OR assigned_to = auth.uid()
      )
    )
    OR (public.app_role() = 'DIRECTION_GENERALE' AND organization_id IN (SELECT public.app_company_org_ids()))
  );

-- DG ne peut PAS créer de fiches (lecture seule sur les données métier)
-- Policy inchangée : seuls les membres de l'org créent des fiches
DROP POLICY IF EXISTS fiches_insert ON public.fiches;
CREATE POLICY fiches_insert ON public.fiches
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.app_org_id()
    AND created_by = auth.uid()
    AND public.app_role() <> 'DIRECTION_GENERALE'
  );

-- DG ne peut PAS modifier de fiches (lecture seule)
DROP POLICY IF EXISTS fiches_update ON public.fiches;
CREATE POLICY fiches_update ON public.fiches
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() <> 'DIRECTION_GENERALE'
    AND (
      public.app_role() = 'ADMIN'
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
      public.app_role() = 'ADMIN'
      OR (created_by = auth.uid() AND status = 'BROUILLON')
    )
  );

-- ─── FICHE_HISTORY ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS fiche_history_select ON public.fiche_history;
CREATE POLICY fiche_history_select ON public.fiche_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fiches f
      WHERE f.id = fiche_history.fiche_id
        AND f.organization_id = public.app_org_id()
    )
    OR (public.app_role() = 'DIRECTION_GENERALE' AND EXISTS (
      SELECT 1 FROM public.fiches f
      WHERE f.id = fiche_history.fiche_id
        AND f.organization_id IN (SELECT public.app_company_org_ids())
    ))
  );

-- DG ne peut pas insérer d'historique (lecture seule)
DROP POLICY IF EXISTS fiche_history_insert ON public.fiche_history;
CREATE POLICY fiche_history_insert ON public.fiche_history
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.app_role() <> 'DIRECTION_GENERALE'
    AND EXISTS (
      SELECT 1 FROM public.fiches f
      WHERE f.id = fiche_history.fiche_id
        AND f.organization_id = public.app_org_id()
    )
  );

-- ─── FICHE_PHOTOS ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS fiche_photos_select ON public.fiche_photos;
CREATE POLICY fiche_photos_select ON public.fiche_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fiches f
      WHERE f.id = fiche_photos.fiche_id
        AND f.organization_id = public.app_org_id()
    )
    OR (public.app_role() = 'DIRECTION_GENERALE' AND EXISTS (
      SELECT 1 FROM public.fiches f
      WHERE f.id = fiche_photos.fiche_id
        AND f.organization_id IN (SELECT public.app_company_org_ids())
    ))
  );

-- DG ne peut pas insérer/supprimer de photos
DROP POLICY IF EXISTS fiche_photos_insert ON public.fiche_photos;
CREATE POLICY fiche_photos_insert ON public.fiche_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.app_role() <> 'DIRECTION_GENERALE'
    AND EXISTS (
      SELECT 1 FROM public.fiches f
      WHERE f.id = fiche_photos.fiche_id
        AND f.organization_id = public.app_org_id()
    )
  );

DROP POLICY IF EXISTS fiche_photos_delete ON public.fiche_photos;
CREATE POLICY fiche_photos_delete ON public.fiche_photos
  FOR DELETE TO authenticated
  USING (
    public.app_role() <> 'DIRECTION_GENERALE'
    AND EXISTS (
      SELECT 1 FROM public.fiches f
      WHERE f.id = fiche_photos.fiche_id
        AND f.organization_id = public.app_org_id()
    )
  );

-- ─── NOTIFICATIONS ──────────────────────────────────────────────────────────
-- Les notifications restent personnelles (user_id = auth.uid()),
-- pas de changement nécessaire pour DG sur select/update/delete.
-- Insert : on peut notifier un membre de sa société (cross-branch pour DG)
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = notifications.user_id
        AND (
          p.organization_id = public.app_org_id()
          OR (public.app_role() = 'DIRECTION_GENERALE' AND p.organization_id IN (SELECT public.app_company_org_ids()))
        )
    )
  );

-- ─── PLANIFICATION_HEBDO ────────────────────────────────────────────────────
-- DG peut lire les planifications de toutes les succursales (lecture seule)
DROP POLICY IF EXISTS planification_hebdo_select ON public.planification_hebdo;
CREATE POLICY planification_hebdo_select ON public.planification_hebdo
  FOR SELECT TO authenticated
  USING (
    organization_id = public.app_org_id()
    OR (public.app_role() = 'DIRECTION_GENERALE' AND organization_id IN (SELECT public.app_company_org_ids()))
  );

-- DG ne peut PAS créer/modifier/supprimer de planifications
DROP POLICY IF EXISTS planification_hebdo_insert ON public.planification_hebdo;
CREATE POLICY planification_hebdo_insert ON public.planification_hebdo
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.app_org_id()
    AND public.app_role() = 'ADMIN'
    AND public.app_role() <> 'DIRECTION_GENERALE'
  );

DROP POLICY IF EXISTS planification_hebdo_update ON public.planification_hebdo;
CREATE POLICY planification_hebdo_update ON public.planification_hebdo
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS planification_hebdo_delete ON public.planification_hebdo;
CREATE POLICY planification_hebdo_delete ON public.planification_hebdo
  FOR DELETE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() = 'ADMIN'
  );

-- =============================================================================
-- 6. Bloquer DIRECTION_GENERALE dans transition_fiche()
-- =============================================================================
CREATE OR REPLACE FUNCTION public.transition_fiche(
  p_fiche_id     UUID,
  p_new_status   public.fiche_status,
  p_comment      TEXT DEFAULT NULL,
  p_assigned_to  UUID DEFAULT NULL
)
RETURNS public.fiches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_role    public.user_role;
  v_org     UUID;
  v_fiche      public.fiches;
  v_old_status public.fiche_status;
  v_allowed    BOOLEAN := false;
  v_action     TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT role, organization_id INTO v_role, v_org
  FROM public.profiles WHERE id = v_uid;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Profil introuvable';
  END IF;

  -- DIRECTION_GENERALE : lecture seule, pas de transitions
  IF v_role = 'DIRECTION_GENERALE' THEN
    RAISE EXCEPTION 'La Direction Générale ne peut pas modifier les fiches';
  END IF;

  SELECT * INTO v_fiche FROM public.fiches WHERE id = p_fiche_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiche introuvable';
  END IF;
  IF v_fiche.organization_id <> v_org THEN
    RAISE EXCEPTION 'Fiche hors de votre organisation';
  END IF;

  v_allowed := CASE
    WHEN v_fiche.status = 'BROUILLON' AND p_new_status = 'SOUMISE'
      THEN v_role IN ('PROSPECTEUR', 'COMMERCIAL', 'ADMIN')
    WHEN v_fiche.status = 'SOUMISE'  AND p_new_status = 'AFFECTEE' THEN v_role = 'ADMIN'
    WHEN v_fiche.status = 'SOUMISE'  AND p_new_status = 'BROUILLON' THEN v_role = 'ADMIN'
    WHEN v_fiche.status = 'AFFECTEE' AND p_new_status IN ('ACCEPTEE', 'REFUSEE')
      THEN v_role IN ('ADMIN', 'COMMERCIAL')
    WHEN v_fiche.status = 'AFFECTEE' AND p_new_status = 'SOUMISE' THEN v_role = 'ADMIN'
    WHEN v_fiche.status = 'ACCEPTEE' AND p_new_status = 'ARCHIVEE' THEN v_role = 'ADMIN'
    WHEN v_fiche.status = 'REFUSEE'  AND p_new_status = 'ARCHIVEE' THEN v_role = 'ADMIN'
    WHEN v_fiche.status = 'REFUSEE'  AND p_new_status = 'AFFECTEE' THEN v_role = 'ADMIN'
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition % → % non autorisée pour le rôle %',
      v_fiche.status, p_new_status, v_role;
  END IF;

  IF p_new_status = 'AFFECTEE' THEN
    IF p_assigned_to IS NULL THEN
      RAISE EXCEPTION 'Un commercial doit être désigné pour affecter la fiche';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_assigned_to AND organization_id = v_org
    ) THEN
      RAISE EXCEPTION 'Commercial cible invalide';
    END IF;
  END IF;

  v_old_status := v_fiche.status;

  UPDATE public.fiches
  SET status      = p_new_status,
      assigned_to = CASE WHEN p_new_status = 'AFFECTEE' THEN p_assigned_to ELSE assigned_to END,
      consentement_rgpd = CASE WHEN p_new_status = 'SOUMISE' THEN true ELSE consentement_rgpd END
  WHERE id = p_fiche_id
  RETURNING * INTO v_fiche;

  v_action := 'Statut : ' || v_old_status || ' → ' || p_new_status;

  INSERT INTO public.fiche_history (fiche_id, organization_id, user_id, action, old_status, new_status, comment)
  VALUES (p_fiche_id, v_org, v_uid, v_action, v_old_status, p_new_status, p_comment);

  IF p_new_status = 'AFFECTEE' AND p_assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
    VALUES (p_assigned_to, v_org, 'FICHE_AFFECTEE', 'Nouvelle fiche affectée',
            'La fiche ' || COALESCE(v_fiche.reference, '') || ' vous a été affectée', p_fiche_id);
  ELSIF p_new_status IN ('ACCEPTEE', 'REFUSEE')
        AND v_fiche.created_by IS NOT NULL
        AND v_fiche.created_by <> v_uid THEN
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, fiche_id)
    VALUES (
      v_fiche.created_by, v_org,
      CASE WHEN p_new_status = 'ACCEPTEE' THEN 'FICHE_ACCEPTEE' ELSE 'FICHE_REFUSEE' END,
      CASE WHEN p_new_status = 'ACCEPTEE' THEN 'Fiche acceptée par le client'
           ELSE 'Fiche refusée par le client' END,
      'Votre fiche ' || COALESCE(v_fiche.reference, '') || ' a été '
        || CASE WHEN p_new_status = 'ACCEPTEE' THEN 'acceptée' ELSE 'refusée' END || '.',
      p_fiche_id
    );
  END IF;

  RETURN v_fiche;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_fiche(UUID, public.fiche_status, TEXT, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.transition_fiche(UUID, public.fiche_status, TEXT, UUID) TO authenticated;
