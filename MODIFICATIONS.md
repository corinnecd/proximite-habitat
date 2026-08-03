# Suivi des modifications — Proximité Habitat Conseil

## 2026-08-03 — Réordonnancement commercial + fix dernier label semaine tronqué

### Réordonnancement du profil commercial
- « Tendance globale hebdomadaire » déplacée en dernière position (après « Évolution en % de mes ventes »), pour mettre en avant les 2 graphiques d'évolution des ventes en premier
- Fichier : `src/components/reporting/CommercialReportingView.tsx`

### Fix : dernier label de l'axe X manquant en vue Semaine
- Symptôme : en granularité Semaine, l'axe semblait s'arrêter mi-juillet alors qu'on est début août
- Diagnostic : ce n'était pas un problème de données (le tracé du graphique atteignait bien le bord droit, jusqu'à la semaine courante) mais un problème d'affichage — la formule `interval={Math.ceil(data.length / 8) - 1}` espace les labels depuis l'index 0 sans jamais garantir l'affichage du tout dernier point (avec ~31 semaines depuis janvier, le dernier label multiple de l'espacement tombait mi-juillet)
- Fix : remplacé par `interval="preserveStartEnd"` (natif Recharts), qui garantit toujours le premier ET le dernier label, en amincissant automatiquement le reste
- Appliqué aux 3 graphiques concernés : `EvolutionChart.tsx` (composant partagé), « Tendance globale hebdomadaire » direction (`reporting/page.tsx`) et commercial (`CommercialReportingView.tsx`)
- Vérifié : dernier label affiché = « 03 août - 09 août » sur les 3 graphiques

## 2026-08-03 — Graphique « Évolution de mes ventes » dans le profil commercial

### Ajout du graphique ventes/CA (non-%) dans CommercialReportingView
- Le profil commercial avait déjà « Évolution en % de mes ventes » mais pas son équivalent en valeurs brutes (nombre de ventes + CA HT), présent côté direction sous le nom « Évolution des ventes par commercial »
- Ajout d'un `<EvolutionChart>` « Évolution de mes ventes » (double axe : Ventes à gauche, CA HT à droite), réutilisant les données déjà calculées (`commEvolutionData`) et la même granularité (`evolGranularity`) que le graphique % existant
- Ordre des sections : Tendance globale hebdomadaire → Évolution de mes ventes (nouveau) → Évolution en % de mes ventes
- « Tendance globale hebdomadaire » n'est PAS supprimée (demande initiale annulée en cours d'échange)
- `CommercialReportingView.tsx` étant partagé entre `/reporting` (commercial connecté) et `/reporting/commercial/[id]` (détail vu par la direction), le changement s'applique aux deux — confirmé avec l'utilisateur. La vue direction consolidée et la vue référent sont inchangées.
- Fichier : `src/components/reporting/CommercialReportingView.tsx`

## 2026-08-03 — Suppression contour gris graphiques + Tendance hebdo alignée sur janvier

### Suppression du contour gris sur les graphiques Recharts
- Quand on cliquait/survolait un graphique, un contour rectangulaire gris apparaissait (outline CSS global `*` appliqué aux SVG)
- 1ère tentative (`.recharts-wrapper:focus, .recharts-surface:focus`) insuffisante : le focus réel atterrit sur un `<g class="recharts-zIndex-layer_100">` interne à Recharts (couche du point actif/tooltip), pas sur les 2 éléments racine
- Fix corrigé : `.recharts-wrapper, .recharts-wrapper * { outline: none; }` — couvre tous les descendants, plus robuste
- Vérifié en navigateur (clic réel sur un point) : plus aucun contour, sur tous les graphiques (Tendance hebdo, Évolution ventes, Évolution %)
- Fichier : `src/app/globals.css`

### « Tendance globale hebdomadaire » alignée sur le 1er janvier calendaire
- Avant : fenêtre glissante de 12 dernières semaines (début mai) — incohérent avec les autres graphiques
- Après : démarre à la semaine ISO contenant le 1er janvier (« 29 déc. - 04 janv. » pour 2026), ~31 semaines affichées
- Labels amincis automatiquement (`interval`) pour gérer la densité, tous les points survolables via tooltip
- Subtitle mis à jour : « Fiches créées et acceptées depuis le début de l'année »
- Appliqué dans les deux vues : direction (`reporting/page.tsx`) et commercial (`CommercialReportingView.tsx`)
- Fichiers : `src/app/(dashboard)/reporting/page.tsx`, `src/components/reporting/CommercialReportingView.tsx`

## 2026-08-02 — Axe des graphiques d'évolution aligné sur l'année calendaire (toutes granularités)

### Alignement calendaire de `generatePeriods` (EvolutionChart.tsx)
- Avant : l'axe démarrait à la 1ère donnée (ex. 1ère vente = mai) au lieu de janvier
- **Toutes les granularités** (Semaine / Mois / Trimestre / Semestre) ancrées sur le 1er janvier de l'année calendaire
- **Semaine** : démarre à la semaine ISO contenant le 1er janvier (ex. « 29 déc. - 04 janv. » pour 2026) — remplace la fenêtre glissante de 12 semaines ; ~31 points en août, labels amincis automatiquement, tous survolables via tooltip
- **Mois / Trimestre / Semestre** : ancrage sur le 1er janvier (janv. / T1 / S1) de l'année ; les périodes sans vente affichent 0
- **Année** : inchangée (déjà alignée au 1er janvier)
- **« Tendance globale hebdomadaire »** : widget séparé, reste sur les 12 dernières semaines (non affecté)
- Avec le filtre « Cette année » en haut de page : l'axe démarre naturellement en janvier de l'année en cours
- Composant partagé → s'applique à tous les graphiques d'évolution (référent, ventes commercial, évolution %, vue commercial)
- Déplacement : « Évolution des fiches par référent » placé sous « Tendance globale hebdomadaire »
- Fichiers : `src/components/reporting/EvolutionChart.tsx`, `src/app/(dashboard)/reporting/page.tsx`

## 2026-08-02 — Graphique dédié « Évolution en % des ventes » + granularité Semestre

### Nouveau graphique d'évolution en pourcentage
- Ajout d'un graphique dédié affichant explicitement l'évolution en % des ventes et du CA d'une période à l'autre (l'évolution % n'existait avant que dans l'info-bulle au survol, donc invisible)
- **Direction** (`reporting/page.tsx`) : « Évolution en % des ventes par commercial » après le graphique des ventes, filtrable par commercial ; nouveaux états `selectedCommEvolPerson` / `commEvolGranularity` + useMemo `commEvolutionPctData`
- **Vue commercial** (`CommercialReportingView.tsx`) : « Évolution en % de mes ventes » après la tendance hebdomadaire, sans sélecteur de personne (ses propres données) ; ajout état `rawFiches` (rempli dans `loadData` + caché localStorage) et `evolGranularity`
- Réutilise `bucketCommercialVentes` (déjà porteur de `ventesEvol`/`caEvol`)

### Granularité « Semestre » (5e période) + props EvolutionChart
- `EvolutionChart.tsx` : ajout `"semester"` au type `Granularity`, à `GRANULARITY_LABELS` et à `generatePeriods` (buckets 6 mois, labels « S1/S2 AAAA »)
- Nouvelles props optionnelles : `hidePersonSelector` (masque le menu déroulant) et `showZeroLine` (ligne de référence à 0 pour lisibilité des valeurs négatives via `ReferenceLine`)
- Fichiers : `src/components/reporting/EvolutionChart.tsx`, `src/app/(dashboard)/reporting/page.tsx`, `src/components/reporting/CommercialReportingView.tsx`

## 2026-08-02 — Messages d'erreur login précis

### Gestion d'erreurs login améliorée
- Ajout d'un `try/catch` autour de `signInWithPassword` pour intercepter les erreurs réseau (fetch qui échoue quand pas de connexion)
- Classification par `error.code` / `error.status` (codes stables Supabase) au lieu de `error.message` (texte anglais fragile)
- Messages selon le cas : mauvais identifiants, trop de tentatives, compte désactivé, pas de connexion internet, serveur injoignable
- Fichier modifié : `src/app/(auth)/login/page.tsx` (fonction `handleSubmit`)

## 2026-08-01 — Axe X dynamique + Évolution % + Fix hooks commerciaux

### Fix "Rendered fewer hooks than expected" (commercial → /reporting)
- Cause : le `return` anticipé pour les commerciaux (`if (isCommercial && profile) return <CommercialReportingView />`) était placé entre le `useEffect` et 4 `useMemo`, violant la règle React d'appel constant des hooks
- Fix : les 4 `useMemo` (`refPersons`, `commPersons`, `refEvolutionData`, `commEvolutionData`) déplacés AVANT le `return` anticipé (lignes 408-411 → avant ligne 453)
- Tous les 35 hooks sont maintenant appelés inconditionnellement avant tout `return`
- Vérifié : build production OK, login commercial sans erreur console
- Fichier modifié : `src/app/(dashboard)/reporting/page.tsx`

### Axe X dynamique (correction cache `.next`)
- Les labels de l'axe X changent désormais correctement selon la granularité choisie : Semaine (`08 juin - 14 juin`), Mois (`juil. 2026`), Trimestre (`T3 2026`), Année (`2026`)
- Cause : cache compilé `.next` périmé empêchait le code mis à jour de s'exécuter — résolu par nettoyage du cache

### Évolution % sur le graphique des ventes par commercial
- `bucketCommercialVentes()` calcule maintenant `ventesEvol` et `caEvol` (% d'évolution vs période précédente) pour chaque bucket
- Cas limites gérés : 1ère période → null, précédent = 0 → null (pas de division par zéro), actuel = 0 → -100%
- Le tooltip (`ChartTooltip`) affiche un badge coloré pour chaque ligne : vert (+X%), rouge (-X%), neutre (0%), absent si null
- Rétrocompatibilité : le graphique référents n'a pas de champs `*Evol` → tooltip inchangé
- Fichier modifié : `src/components/reporting/EvolutionChart.tsx`

## 2026-08-01 — Graphiques d'évolution référents & commerciaux (Reporting Direction)

### Nouveau composant `EvolutionChart`
- `src/components/reporting/EvolutionChart.tsx` : composant réutilisable pour graphiques d'évolution temporelle
- Sélecteur de personne (menu déroulant) : "Tous" ou un individu spécifique
- Sélecteur de granularité (pills) : Semaine / Mois / Trimestre / Année
- AreaChart Recharts avec support double axe Y (gauche + droite)
- Tooltip personnalisé avec formatters par ligne, légende auto-générée
- Fonctions utilitaires `bucketReferentFiches()` et `bucketCommercialVentes()` pour le calcul des séries temporelles

### Intégration dans `/reporting` (direction)
- Graphique « Évolution des fiches par référent » : nombre de fiches créées par période, filtrable par référent, couleur bleue (#3b82f6)
- Graphique « Évolution des ventes par commercial » : double axe — ventes (vert #10b981, axe gauche) + CA HT (ambre #f59e0b, axe droit en k€), filtrable par commercial
- Positionnés après le tableau des commerciaux et avant le pie chart / tableau des référents
- Données calculées via `useMemo` à partir des fiches brutes déjà chargées (aucune requête supplémentaire)
- États ajoutés : `rawFiches`, `selectedRefPerson`, `selectedCommPerson`, `refGranularity`, `commGranularity`
- Fichier modifié : `src/app/(dashboard)/reporting/page.tsx`

## 2026-08-01 — Reporting commercial : vue identique pour la direction

### Composant partagé `CommercialReportingView`
- Nouveau composant `src/components/reporting/CommercialReportingView.tsx` : reproduit à l'identique la vue reporting personnelle d'un commercial (KPIs, funnel, pie chart, performance, analyse refus/acceptations, tendance hebdomadaire)
- Utilisé par la page `/reporting/commercial/[id]` (direction drill-down) ET par `/reporting` quand le rôle est COMMERCIAL (même composant, mêmes données, mêmes chiffres)
- Paramètres configurables : `subjectId`, `topbarTitle`, `backHref`, `backLabel` — permet d'adapter le Topbar sans toucher au contenu

### Page `/reporting/commercial/[id]` — refonte
- Remplacée par un wrapper léger autour de `CommercialReportingView` — l'ancienne page affichait une liste de fiches par statut, la nouvelle affiche les mêmes blocs que le commercial voit sur `/reporting`
- Topbar : nom du commercial + bouton « Retour au Tableau de Bord Direction » + Export PDF/CSV
- Fichiers modifiés : `src/app/(dashboard)/reporting/commercial/[id]/page.tsx`

### Page `/reporting` — commercial délégué
- Quand `profile.role === "COMMERCIAL"`, la page rend directement `<CommercialReportingView subjectId={profile.id} />` au lieu de charger les données consolidées direction
- Import ajouté + early return après les hooks — aucun hook conditionnel, pas de violation des règles React
- Fichier modifié : `src/app/(dashboard)/reporting/page.tsx`

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
