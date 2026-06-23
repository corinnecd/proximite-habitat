-- Ajout des champs rendez-vous et référent habitant sur la fiche
ALTER TABLE fiches
  ADD COLUMN IF NOT EXISTS rdv_date DATE,
  ADD COLUMN IF NOT EXISTS referent_nom TEXT,
  ADD COLUMN IF NOT EXISTS referent_telephone TEXT;
