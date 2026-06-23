-- Ajouter le rôle CHEF_EQUIPE
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CHEF_EQUIPE';

-- Lien prospecteur → chef d'équipe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chef_equipe_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Modifier planification_hebdo : renommer prospecteur_id en chef_equipe_id
ALTER TABLE planification_hebdo RENAME COLUMN prospecteur_id TO chef_equipe_id;
