-- Ajoute un nom et une date effective au parcours pour faciliter l'identification
ALTER TABLE parcours_hebdo
  ADD COLUMN IF NOT EXISTS nom TEXT,
  ADD COLUMN IF NOT EXISTS date_effective DATE;

-- Index pour la recherche par nom
CREATE INDEX IF NOT EXISTS idx_parcours_hebdo_nom
  ON parcours_hebdo(organization_id, nom);
