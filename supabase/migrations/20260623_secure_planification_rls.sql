-- =============================================================================
-- Renforcement RLS planification_hebdo — isolation par organisation + rôle ADMIN
-- =============================================================================

-- Supprimer les anciennes policies trop permissives
DROP POLICY IF EXISTS "planification_hebdo_read" ON planification_hebdo;
DROP POLICY IF EXISTS "planification_hebdo_insert" ON planification_hebdo;
DROP POLICY IF EXISTS "planification_hebdo_update" ON planification_hebdo;
DROP POLICY IF EXISTS "planification_hebdo_delete" ON planification_hebdo;

-- SELECT : tout membre de l'organisation peut lire les planifications
CREATE POLICY "planification_hebdo_select"
  ON planification_hebdo FOR SELECT
  USING (organization_id = public.app_org_id());

-- INSERT : seuls les ADMIN de l'organisation peuvent créer
CREATE POLICY "planification_hebdo_insert"
  ON planification_hebdo FOR INSERT
  WITH CHECK (
    organization_id = public.app_org_id()
    AND public.app_role() = 'ADMIN'
  );

-- UPDATE : seuls les ADMIN de l'organisation peuvent modifier
CREATE POLICY "planification_hebdo_update"
  ON planification_hebdo FOR UPDATE
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() = 'ADMIN'
  );

-- DELETE : seuls les ADMIN de l'organisation peuvent supprimer
CREATE POLICY "planification_hebdo_delete"
  ON planification_hebdo FOR DELETE
  USING (
    organization_id = public.app_org_id()
    AND public.app_role() = 'ADMIN'
  );
