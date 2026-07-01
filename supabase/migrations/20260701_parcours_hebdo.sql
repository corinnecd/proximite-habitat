-- Parcours hebdomadaire (tracé d'itinéraire sur la carte des villes planifiées)
-- Un parcours par (organisation, semaine, chef d'équipe)
CREATE TABLE IF NOT EXISTS parcours_hebdo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  semaine_du DATE NOT NULL, -- toujours un lundi
  chef_equipe_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL = toute l'équipe

  -- Points cliqués par l'utilisateur : [[lat, lng], [lat, lng], ...]
  waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Géométrie complète du tracé calculé par OSRM : [[lat, lng], [lat, lng], ...]
  route_geometry JSONB NOT NULL DEFAULT '[]'::jsonb,

  distance_m INTEGER, -- distance totale en mètres
  duration_s INTEGER, -- durée estimée à pied en secondes

  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id, semaine_du, chef_equipe_id)
);

CREATE INDEX IF NOT EXISTS idx_parcours_hebdo_semaine
  ON parcours_hebdo(organization_id, semaine_du);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_parcours_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parcours_updated_at ON parcours_hebdo;
CREATE TRIGGER parcours_updated_at
  BEFORE UPDATE ON parcours_hebdo
  FOR EACH ROW EXECUTE FUNCTION set_parcours_updated_at();

-- RLS : même politique que planification_hebdo
ALTER TABLE parcours_hebdo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parcours_hebdo_read" ON parcours_hebdo
  FOR SELECT USING (true);

CREATE POLICY "parcours_hebdo_insert" ON parcours_hebdo
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DIRECTION_GENERALE')
  );

CREATE POLICY "parcours_hebdo_update" ON parcours_hebdo
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DIRECTION_GENERALE')
  );

CREATE POLICY "parcours_hebdo_delete" ON parcours_hebdo
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DIRECTION_GENERALE')
  );
