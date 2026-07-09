-- =============================================================================
-- Fix RLS critique : cross-tenant sur parcours_hebdo + alignement planif
-- =============================================================================
-- Contexte de l'audit :
--   1. La migration 20260701_parcours_hebdo.sql autorisait un utilisateur avec
--      rôle DIRECTION_GENERALE à voir/modifier N'IMPORTE quel parcours de
--      N'IMPORTE quelle société (pas seulement la sienne). Correction ici.
--   2. planification_hebdo_insert/update/delete refusait les rôles COMMERCIAL
--      et CHEF_EQUIPE alors que l'UI les autorise. Aligné avec l'UI.
-- =============================================================================

-- ─── PARCOURS_HEBDO — SELECT ────────────────────────────────────────────────
DROP POLICY IF EXISTS parcours_hebdo_read ON public.parcours_hebdo;
CREATE POLICY parcours_hebdo_read ON public.parcours_hebdo
  FOR SELECT TO authenticated
  USING (
    organization_id = public.app_org_id()
    OR (
      public.app_role() = 'DIRECTION_GENERALE'
      AND organization_id IN (SELECT public.app_company_org_ids())
    )
  );

-- ─── PARCOURS_HEBDO — INSERT ────────────────────────────────────────────────
-- Écriture réservée à sa propre organisation. DG en lecture seule.
DROP POLICY IF EXISTS parcours_hebdo_insert ON public.parcours_hebdo;
CREATE POLICY parcours_hebdo_insert ON public.parcours_hebdo
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

-- ─── PARCOURS_HEBDO — UPDATE ────────────────────────────────────────────────
DROP POLICY IF EXISTS parcours_hebdo_update ON public.parcours_hebdo;
CREATE POLICY parcours_hebdo_update ON public.parcours_hebdo
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  )
  WITH CHECK (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

-- ─── PARCOURS_HEBDO — DELETE ────────────────────────────────────────────────
DROP POLICY IF EXISTS parcours_hebdo_delete ON public.parcours_hebdo;
CREATE POLICY parcours_hebdo_delete ON public.parcours_hebdo
  FOR DELETE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

-- ─── PLANIFICATION_HEBDO — INSERT/UPDATE/DELETE : élargi à CHEF_EQUIPE et COMMERCIAL ──
DROP POLICY IF EXISTS planification_hebdo_insert ON public.planification_hebdo;
CREATE POLICY planification_hebdo_insert ON public.planification_hebdo
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

DROP POLICY IF EXISTS planification_hebdo_update ON public.planification_hebdo;
CREATE POLICY planification_hebdo_update ON public.planification_hebdo
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );

DROP POLICY IF EXISTS planification_hebdo_delete ON public.planification_hebdo;
CREATE POLICY planification_hebdo_delete ON public.planification_hebdo
  FOR DELETE TO authenticated
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() IN ('ADMIN', 'CHEF_EQUIPE', 'COMMERCIAL')
  );
