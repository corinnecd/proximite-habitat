-- Chiffre d'affaires HT par fiche (renseigné lors de l'acceptation client)
ALTER TABLE fiches ADD COLUMN IF NOT EXISTS montant_ht NUMERIC(12,2) DEFAULT NULL;
