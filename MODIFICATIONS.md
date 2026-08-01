# Suivi des modifications — Proximité Habitat Conseil

## 2026-08-01 — Reporting direction & Fiches (ajustements UX)

### Navigation reporting
- Clic sur un nom de commercial/référent dans `/reporting` (direction) : ouverture d'un dialog de confirmation ("Vous allez accéder au tableau de bord reporting de [Nom]…") avant de naviguer vers le dashboard individuel — `src/app/(dashboard)/reporting/page.tsx`
- Bouton "Retour" sur les pages `reporting/commercial/[id]` et `reporting/referent/[id]` → renommé "Retour au Tableau de Bord Direction", navigue directement vers `/reporting`

### Page Fiches
- Pastille numérique du bouton "Antérieures" : recalculée pour ne compter que les fiches ARCHIVÉE (au lieu de toutes les fiches non mises à jour depuis le trimestre), puis supprimée entièrement — `src/app/(dashboard)/fiches/page.tsx`

### Reporting — Taux (Acceptation / Refus / En cours)
- Cartes réordonnées : Acceptation → Refus → En cours (alignement sur l'ordre du tableau de bord)
- Dénominateur (`baseActive`) aligné sur le calcul du tableau de bord (exclusion de RDV_TECHNICIEN et INSTALLEE) : les 3 taux somment désormais à 100%
- Arrondi "plus grand reste" (`roundToHundred`) appliqué aux blocs "Analyse des refus" et "Analyse Globale des Acceptations" pour que la somme des pourcentages affichés fasse toujours exactement 100%

### Reporting — nouveau bloc "Analyse Globale des Acceptations"
- Donut + 4 cartes détaillant le parcours d'acceptation : Acceptation client (ACCEPTEE), Attente acceptation client (RETRACTATION), RDV Technicien planifié (RDV_TECHNICIEN), Installation réalisée (INSTALLEE) — même pattern visuel que le bloc refus existant

### Reporting — libellés & couleurs
- Tableau "Ventes globales par référent" renommé "Nombre de fiches (globales) par référent"
- Palette de couleurs du donut "Répartition globale par statut" revue pour éliminer les doublons visuels : VALIDEE (indigo) désormais distinct d'ACCEPTEE (émeraude), RETRACTATION (rose) distinct de RDV_TECHNICIEN (violet), RDV_A_REPRENDRE (jaune) distinct d'AFFECTEE (orange)

## 2026-06-23/24 — Multi-société & succursales (Direction Générale)

> Objectif : permettre à une **société mère** de regrouper plusieurs **succursales**
> (chaque succursale = une `organization` existante, totalement cloisonnée), avec un
> rôle **DIRECTION_GENERALE** en **lecture seule** consolidée cross-succursales.
> Les sociétés distinctes restent des instances totalement indépendantes.

### Phase 1 — Base de données (`supabase/migrations/20260623_companies_branches.sql`)
- Table `companies` (société mère) + RLS.
- `organizations` : colonnes `company_id` (FK companies) et `is_hq` (siège).
- Nouveau rôle enum `DIRECTION_GENERALE`.
- Fonctions RLS `app_company_id()` et `app_company_org_ids()` (SECURITY DEFINER).
- Toutes les policies (organizations, profiles, fiches, fiche_history, fiche_photos,
  notifications, planification_hebdo) étendues : DG **voit** toutes les succursales de
  sa société ; DG **bloqué** en écriture sur les données métier (fiches/photos/historique/
  planification). DG peut gérer les profils cross-branch.
- `transition_fiche()` : rejette toute transition demandée par un DG (lecture seule).

### Phase 2 — TypeScript (types + permissions)
- `UserRole` += `DIRECTION_GENERALE` ; type `Company` ; `Organization` += `company_id`, `is_hq`.
- `permissions.ts` : `canManageUsers` autorise DG ; `canEditFiche`/`canEditRdvDate` bloquent DG ;
  `isDirectionGenerale()` ; label « Direction Générale » ; aucune transition pour DG.
- `/api/users` (POST+PATCH) : DG peut créer/modifier des utilisateurs dans n'importe quelle
  succursale de sa société (contrôle cross-branch via `company_id`).
- Tests `permissions.test.ts` mis à jour (16/16 OK) + cas DG ajoutés.

### Phase 3 — UI Direction Générale
- `BranchContext` (`selectedBranchId: string | "all"` + liste succursales) branché dans le layout.
- `BranchSelector` dans la sidebar (DG uniquement).
- Dashboard, `/fiches`, `/reporting`, `/planification`, `/utilisateurs` : DG traité comme ADMIN
  pour l'affichage, filtre `organization_id` appliqué quand une succursale précise est choisie,
  boutons d'action (Affecter, etc.) masqués pour DG (lecture seule).

### Phase 4 — API & onboarding
- `POST /api/branches` : création d'une succursale par un DG (slug auto, rattachée à sa société).
- `POST /api/companies` : bootstrap société + siège (`is_hq`) + compte DG. Protégé par l'en-tête
  `x-platform-secret` comparé à `PLATFORM_ADMIN_SECRET` (rollback complet en cas d'échec).
- Pages `/admin/societe` (infos société + compteurs) et `/admin/succursales` (liste + création),
  liens ajoutés dans la sidebar (section « Direction Générale »).

**Ce qui ne change PAS** : aucune table de données métier modifiée, `organization_id` garde son
nom et sa sémantique, tous les rôles existants fonctionnent à l'identique. Déploiements
mono-organisation existants intacts (`company_id` nullable, aucun DG par défaut).

**Reste à faire (hors périmètre de cette session)** : variable d'env `PLATFORM_ADMIN_SECRET` à
définir ; rattacher les `organizations` existantes à une `company` si l'on veut activer un DG ;
appliquer la migration sur Supabase. 3 tests pré-existants en échec (`stats.test.ts`,
`validations/fiche.test.ts`) sans lien avec ce chantier.

## 2026-06-22

### Chiffre d'affaires — corrections affichage et statistiques (FAIT)
- Dashboard Commercial : ajout de 4 KPI cards (Ventes, CA HT total, Panier moyen, Taux de conversion) + tableau détaillé CA par fiche acceptée
- Dashboard Direction : ajout de 4 KPI cards consolidés + tableaux CA par référent et CA par commercial avec lignes totaux
- Reporting : enrichissement des KPIs (8 au lieu de 6), ajout CA par référent avec tableau structuré, refonte tableau commerciaux avec colonnes CA

### Ajustements Dashboard + Reporting (FAIT)

#### Dashboard Commercial
1. Supprimer le KPI "Taux de conversion" — FAIT
2. Renommer "Panier moyen HT" en "Chiffre d'affaires moyen" — FAIT

#### Dashboard Direction
3. Supprimer le KPI "Taux de conversion" — FAIT
4. Renommer "Panier moyen HT" en "Chiffre d'affaires moyen" — FAIT
5. Renommer "CA par référent" en "Ventes par référent" et supprimer la colonne CA HT dans le tableau référents — FAIT
6. Rendre les KPI du haut dynamiques selon le filtre période (CA, ventes, CA moyen filtrent maintenant sur updated_at) — FAIT

#### Reporting (Commercial + Direction)
7. Renommer "Panier moyen HT" en "Chiffre d'affaires moyen" — FAIT
8. Supprimer les KPI "Taux d'acceptation" et "Taux de transformation" — FAIT
9. Supprimer la colonne CA HT dans le tableau référents (titre changé en "Ventes par référent") — FAIT
10. Déplacer le bloc "Tendance hebdomadaire" après les commerciaux, juste avant les statistiques par ville — FAIT
