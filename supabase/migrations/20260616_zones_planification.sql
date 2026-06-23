-- Départements autorisés pour la prospection
CREATE TABLE IF NOT EXISTS zones_departements (
  code TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  region TEXT NOT NULL
);

INSERT INTO zones_departements (code, nom, region) VALUES
  ('75', 'Paris', 'Île-de-France'),
  ('77', 'Seine-et-Marne', 'Île-de-France'),
  ('78', 'Yvelines', 'Île-de-France'),
  ('91', 'Essonne', 'Île-de-France'),
  ('92', 'Hauts-de-Seine', 'Île-de-France'),
  ('93', 'Seine-Saint-Denis', 'Île-de-France'),
  ('94', 'Val-de-Marne', 'Île-de-France'),
  ('95', 'Val-d''Oise', 'Île-de-France'),
  ('60', 'Oise', 'Hauts-de-France')
ON CONFLICT (code) DO NOTHING;

-- Villes par département
CREATE TABLE IF NOT EXISTS zones_villes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  departement_code TEXT NOT NULL REFERENCES zones_departements(code),
  nom TEXT NOT NULL,
  code_postal TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  UNIQUE(departement_code, nom, code_postal)
);

-- Planification hebdomadaire (Direction assigne des villes aux prospecteurs par semaine)
CREATE TABLE IF NOT EXISTS planification_hebdo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  semaine_du DATE NOT NULL, -- toujours un lundi
  ville_id UUID NOT NULL REFERENCES zones_villes(id) ON DELETE CASCADE,
  prospecteur_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL = toute l'équipe
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, semaine_du, ville_id, prospecteur_id)
);

-- Nouveaux champs sur fiches
ALTER TABLE fiches ADD COLUMN IF NOT EXISTS departement_code TEXT REFERENCES zones_departements(code);
ALTER TABLE fiches ADD COLUMN IF NOT EXISTS ville_id UUID REFERENCES zones_villes(id);

-- RLS
ALTER TABLE zones_departements ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones_villes ENABLE ROW LEVEL SECURITY;
ALTER TABLE planification_hebdo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zones_departements_read" ON zones_departements FOR SELECT USING (true);
CREATE POLICY "zones_villes_read" ON zones_villes FOR SELECT USING (true);
CREATE POLICY "planification_hebdo_read" ON planification_hebdo FOR SELECT USING (true);
CREATE POLICY "planification_hebdo_insert" ON planification_hebdo FOR INSERT WITH CHECK (true);
CREATE POLICY "planification_hebdo_update" ON planification_hebdo FOR UPDATE USING (true);
CREATE POLICY "planification_hebdo_delete" ON planification_hebdo FOR DELETE USING (true);
