-- ============================================
-- Proximité Habitat Conseil — Schéma initial
-- ============================================

-- Enums
CREATE TYPE user_role AS ENUM ('ADMIN', 'COMMERCIAL', 'PROSPECTEUR');
CREATE TYPE fiche_status AS ENUM ('BROUILLON', 'SOUMISE', 'AFFECTEE', 'ACCEPTEE', 'REFUSEE', 'ARCHIVEE');

-- ============================================
-- Organizations (multi-tenant ready)
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Profiles (linked to auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'PROSPECTEUR',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_organization ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================
-- Fiches de pré-visite
-- ============================================
CREATE TABLE fiches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  status fiche_status NOT NULL DEFAULT 'BROUILLON',
  created_by UUID NOT NULL REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),

  -- Coordonnées prospect
  prospect_nom TEXT NOT NULL DEFAULT '',
  prospect_prenom TEXT NOT NULL DEFAULT '',
  prospect_adresse TEXT NOT NULL DEFAULT '',
  prospect_cp TEXT NOT NULL DEFAULT '',
  prospect_ville TEXT NOT NULL DEFAULT '',
  prospect_telephone TEXT NOT NULL DEFAULT '',
  disponibilites TEXT[] NOT NULL DEFAULT '{}',
  date_visite DATE,
  heure_visite TIME,

  -- Caractéristiques habitation
  annee_construction INTEGER,
  annee_emmenagement INTEGER,
  temperature_confort NUMERIC,
  surface_chauffee NUMERIC,
  nb_habitants INTEGER,
  maison_en_vente BOOLEAN,

  -- Chauffage
  modes_chauffage TEXT[] NOT NULL DEFAULT '{}',
  systemes_chauffage TEXT[] NOT NULL DEFAULT '{}',
  consommation TEXT,
  cout_annuel NUMERIC,

  -- Ventilation
  systemes_ventilation TEXT[] NOT NULL DEFAULT '{}',
  age_ventilation TEXT,

  -- Isolation
  nature_isolant TEXT[] NOT NULL DEFAULT '{}',
  age_isolant TEXT,
  epaisseur_isolant TEXT,

  -- Toiture
  types_pose_toiture TEXT[] NOT NULL DEFAULT '{}',
  materiaux_toiture TEXT[] NOT NULL DEFAULT '{}',

  -- Observations & signature
  observations TEXT,
  signature_url TEXT,
  consentement_rgpd BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiches_organization ON fiches(organization_id);
CREATE INDEX idx_fiches_status ON fiches(status);
CREATE INDEX idx_fiches_created_by ON fiches(created_by);
CREATE INDEX idx_fiches_assigned_to ON fiches(assigned_to);

-- ============================================
-- Photos des fiches
-- ============================================
CREATE TABLE fiche_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id UUID NOT NULL REFERENCES fiches(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiche_photos_fiche ON fiche_photos(fiche_id);

-- ============================================
-- Historique des fiches
-- ============================================
CREATE TABLE fiche_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id UUID NOT NULL REFERENCES fiches(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  old_status fiche_status,
  new_status fiche_status,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiche_history_fiche ON fiche_history(fiche_id);

-- ============================================
-- Notifications
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  fiche_id UUID REFERENCES fiches(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

-- ============================================
-- Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_organizations_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_fiches_updated_at
  BEFORE UPDATE ON fiches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Auto-generate fiche reference
-- ============================================
CREATE OR REPLACE FUNCTION generate_fiche_reference()
RETURNS TRIGGER AS $$
DECLARE
  today_str TEXT;
  seq INTEGER;
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    today_str := to_char(now(), 'YYYYMMDD');
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(reference FROM '[0-9]+$') AS INTEGER)
    ), 0) + 1
    INTO seq
    FROM fiches
    WHERE reference LIKE 'PHC-' || today_str || '-%';

    NEW.reference := 'PHC-' || today_str || '-' || LPAD(seq::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_fiches_reference
  BEFORE INSERT ON fiches FOR EACH ROW EXECUTE FUNCTION generate_fiche_reference();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiches ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiche_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiche_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's org (public schema — Supabase blocks auth schema)
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Organizations: users see only their org
CREATE POLICY "users_view_own_org" ON organizations
  FOR SELECT USING (id = public.get_user_org_id());

-- Profiles: users see profiles in their org
CREATE POLICY "users_view_org_profiles" ON profiles
  FOR SELECT USING (organization_id = public.get_user_org_id());

CREATE POLICY "admins_manage_profiles" ON profiles
  FOR ALL USING (
    organization_id = public.get_user_org_id()
    AND public.get_user_role() = 'ADMIN'
  );

-- Fiches: role-based access
CREATE POLICY "admins_full_access_fiches" ON fiches
  FOR ALL USING (
    organization_id = public.get_user_org_id()
    AND public.get_user_role() = 'ADMIN'
  );

CREATE POLICY "commercials_view_fiches" ON fiches
  FOR SELECT USING (
    organization_id = public.get_user_org_id()
    AND public.get_user_role() = 'COMMERCIAL'
  );

CREATE POLICY "commercials_update_fiches" ON fiches
  FOR UPDATE USING (
    organization_id = public.get_user_org_id()
    AND public.get_user_role() = 'COMMERCIAL'
    AND (created_by = auth.uid() OR assigned_to = auth.uid())
  );

CREATE POLICY "commercials_insert_fiches" ON fiches
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_org_id()
    AND public.get_user_role() = 'COMMERCIAL'
    AND created_by = auth.uid()
  );

CREATE POLICY "prospecteurs_view_own_fiches" ON fiches
  FOR SELECT USING (
    organization_id = public.get_user_org_id()
    AND public.get_user_role() = 'PROSPECTEUR'
    AND created_by = auth.uid()
  );

CREATE POLICY "prospecteurs_insert_fiches" ON fiches
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_org_id()
    AND public.get_user_role() = 'PROSPECTEUR'
    AND created_by = auth.uid()
  );

CREATE POLICY "prospecteurs_update_own_fiches" ON fiches
  FOR UPDATE USING (
    organization_id = public.get_user_org_id()
    AND public.get_user_role() = 'PROSPECTEUR'
    AND created_by = auth.uid()
    AND status = 'BROUILLON'
  );

-- Fiche photos: follow fiche access
CREATE POLICY "org_access_fiche_photos" ON fiche_photos
  FOR ALL USING (organization_id = public.get_user_org_id());

-- Fiche history: follow fiche access
CREATE POLICY "org_access_fiche_history" ON fiche_history
  FOR SELECT USING (organization_id = public.get_user_org_id());

CREATE POLICY "org_insert_fiche_history" ON fiche_history
  FOR INSERT WITH CHECK (organization_id = public.get_user_org_id());

-- Notifications: users see only their own
CREATE POLICY "users_view_own_notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "org_insert_notifications" ON notifications
  FOR INSERT WITH CHECK (organization_id = public.get_user_org_id());
