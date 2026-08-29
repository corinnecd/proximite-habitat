# Suivi des modifications — Proximité Habitat Conseil

## 2026-08-29 — Suppression des objectifs commerciaux + UX mobile validée de 320 à 390 px

### 1. Objectifs commerciaux retirés
La fonctionnalité n'a plus lieu d'être. Tout ce qui en dépendait est supprimé :
- **Composant `CommercialObjectifs`** supprimé. Le fichier ne contenait plus que `CommercialRdvDuJour`, sans rapport : renommé `components/dashboard/CommercialRdvDuJour.tsx` (via `git mv`, historique préservé).
- **Dashboard** (`page.tsx`) : bloc « Objectifs du mois » retiré, seul le RDV du jour subsiste.
- **Types** (`types/database.types.ts`) : table `objectifs_commerciaux` et type `ObjectifCommercial` retirés.
- **Test e2e** « le commercial voit ses objectifs du mois » supprimé, avec son gating `E2E_WITH_OBJECTIFS`. La suite ne compte donc plus qu'un seul test ignoré (le compte DG).
- Import `Target` devenu inutilisé retiré.

**Conservé volontairement** : le bloc « Objectif mensuel de prime (3 ventes) » de `AdminKpiSection`. Vérifié — il ne lit pas `objectifs_commerciaux` : c'est la prime des **référents**, calculée depuis leur nombre de ventes. Concept distinct. À supprimer aussi si ce n'était pas l'intention.

**Reste à faire côté base** : la table `objectifs_commerciaux` existe toujours (vide). Plus aucun code ne la lit. Pour la supprimer :
```sql
drop table if exists public.objectifs_commerciaux;
```
Le fichier `supabase/migrations/20260722_objectifs_commerciaux.sql` est conservé : une migration appliquée fait partie de l'historique et ne se réécrit pas.

### 2. « Désactiver » qui passait seul à la ligne
Page Utilisateurs — les deux badges et les deux boutons partageaient un unique `flex-wrap` en `justify-end` : au repli, « Désactiver » se retrouvait seul sur une ligne, aligné à droite. Les deux actions forment désormais un groupe et se replient ensemble ; alignement à gauche sous `sm`.

### 3. UX mobile validée jusqu'à 320 px
Les utilisateurs de l'entreprise sont majoritairement sur mobile. Audit élargi à **320, 360 et 390 px** × 3 profils × 8 pages, avec relevé des débordements (en nommant l'élément fautif) et des cibles tactiles.

Deux défauts trouvés à 320 px, invisibles à 390 :
- **Légende du camembert** (`reporting`) : 2 colonnes fixes ne laissaient que ~140 px par entrée, et les libellés longs (« Attente Acceptation Client ») débordaient. Une seule colonne sous `sm`, plus `min-w-0` sur la ligne.
- **Tableau « Taux d'acceptation par commercial »** : `grid-cols-[1fr_48px_48px_48px_70px]` consommait 238 px sur les ~240 disponibles, ne laissant rien à la colonne des noms. Colonnes resserrées en mobile (`38px`/`58px`, gap réduit) — noms tronqués mais chiffres complets et alignés.

**Résultat : aucun constat** sur les 3 largeurs, 3 profils, 8 pages — zéro débordement, zéro cible sous 32 px.

### Vérification
`tsc` 0 erreur, build vert, unitaires 51/51, e2e 17 PASS / 0 FAIL / 1 skipped.


## 2026-08-28 — Boutons centrés et blocs recomposés en mobile étroit (364 px)

Défauts signalés sur captures réelles à **364 px**. Mon audit tournait à 390 px : ces problèmes n'apparaissaient pas à cette largeur. Reproduits à 364 px, corrigés, revérifiés à 364 px.

### Fiche détail
- **Barre d'actions en escalier** : le bouton RDV portait `ml-auto`, qui le plaquait à droite de la ligne repliée. Résultat : deux boutons, puis un à gauche, puis un à droite. `ml-auto` conditionné à `sm`, et la barre est centrée sous `sm` — trois lignes symétriques.
- **Carte « Commercial affecté »** : sur une seule ligne, le libellé se coupait en deux (« COMMERCIAL / AFFECTÉ ») et le nom du commercial était tronqué (« Virg… ») par le bouton. Passée en colonne sous `sm` : libellé, nom complet, puis bouton pleine largeur.
- **Bandeau « Annuler la validation »** : texte réparti sur trois lignes face à un bouton comprimé contre le bord. Empilé sous `sm`.

### Page Fiches
- **Rangée de filtres de statut coupée net au bord de l'écran** : le conteneur en `overflow-x-auto` donnait un bouton tranché, sans le moindre indice qu'il fallait faire défiler. Remplacé par un repli centré — tous les statuts visibles, sur deux lignes.
- **Puces de période et « Filtres avancés » centrés** sous `sm` : la répartition à gauche laissait des lignes inégales.

### Dashboard
- **Puces de période centrées** sous `sm`, même motif.

### Vérification
Aucun débordement horizontal à 364 px. `tsc` 0 erreur, build vert, unitaires 51/51, e2e 17 PASS / 0 FAIL.

**Note** : deux exécutions e2e ont échoué sur `ERR_NETWORK_IO_SUSPENDED` et `ERR_EMPTY_RESPONSE` — la machine suspend ses E/S réseau et le serveur de dev tombe. Erreurs d'environnement, pas de régression : les exécutions suivantes sont vertes.

### Enseignement
Auditer à 390 px ne suffit pas. Les écrans de 360-375 px (iPhone SE, nombreux Android) sont plus contraints, et c'est là que les lignes repliées se déséquilibrent. À intégrer aux prochains audits.


## 2026-08-28 — Cartes KPI du dashboard sur 2 colonnes en mobile

Les 6 cartes KPI (CA consolidé, ventes, CA moyen, taux d'acceptation, de refus, en cours) s'empilaient sur une seule colonne en mobile — environ 600 px de défilement pour la seule zone d'indicateurs.

**Première tentative, 2 colonnes simples** : chaque groupe compte 3 cartes, donc la troisième se retrouvait seule avec un vide béant à sa droite. Deux trous sur la page — visuellement pire que la colonne unique.

**Retenu** : 2 colonnes, et la troisième carte de chaque groupe occupe toute la largeur (`[&>*:last-child]:col-span-2`, annulé dès `sm`). Deux cartes côte à côte, puis une pleine largeur : aucun trou, rythme régulier. Padding réduit à `p-4` sous `sm` pour desservir le texte.

**Mesuré** : hauteur de page de **3834 px à 3500 px, soit 334 px de défilement en moins** (−9 %), sans débordement horizontal. Desktop vérifié inchangé — les 3 cartes restent alignées sur une ligne.

Fichier : `components/dashboard/AdminKpiSection.tsx`.

### Note de méthode
La carte « Refusée » apparaît surélevée sur les captures : ce n'est pas un défaut de style — les sept cartes partagent des classes identiques. C'est l'état `hover:`, la souris restant positionnée là où le bouton « Se connecter » a été cliqué avant la navigation.


## 2026-08-28 — Audit visuel (suite) : 4 défauts que l'automatisation ne voyait pas

Les contrôles automatiques (débordement, console, réseau, cibles tactiles) ne remontaient plus rien. Cette passe est l'**examen visuel des captures**, page par page — le volet qualité qu'aucune détection automatique ne couvre.

### Calendrier mobile : dimanche invisible
Le `min-w-[420px]` que j'avais ajouté pour éviter l'écrasement des colonnes dépassait la largeur d'un écran de 390 px : **la 7ᵉ colonne (dimanche) se retrouvait hors écran**, derrière un scroll horizontal que rien ne signalait. Un utilisateur mobile ne voyait jamais ses RDV du dimanche.

Largeur minimale retirée : les 7 colonnes tiennent, les chips d'événement ont déjà `truncate`, et le détail complet du jour reste accessible au tap. `overflow-x-auto` est conservé comme filet de sécurité pour les écrans très étroits.

### Fiche détail : métadonnées affichées deux fois
« Créée le », « Modifiée le », « Commercial » et « Consentement RGPD obtenu » apparaissaient **simultanément dans la barre latérale et dans la carte Consentement RGPD** — la même information deux fois sur le même écran, en desktop comme en mobile. Vérifié qu'aucune règle ne masque la barre latérale à l'impression : la duplication existait donc aussi dans le PDF. Les trois lignes redondantes sont retirées de la carte, qui se concentre sur son objet — l'état du consentement.

### Fiche détail : libellés qui se chevauchent
La carte « Caractéristiques du logement » occupe un tiers de la largeur mais utilisait une grille de 3 colonnes : environ 90 px pour des libellés comme « ANNÉE EMMÉNAGEMENT », qui se chevauchaient visuellement. Passée à 2 colonnes.

### Planification mobile : bouton hors de sa carte
`justify-between` sans repli poussait « Dupliquer semaine précédente » **au-delà du bord de la carte**, coupé au bord de l'écran. Ligne rendue repliable : titre et bouton sur deux lignes.

### Résultat
Unitaires 51/51, e2e 17 PASS / 0 FAIL / 2 skipped, build vert.

### Points mineurs relevés, non corrigés
- Dashboard mobile : les 6 cartes KPI s'empilent sur une colonne (~600 px de défilement). Lisible, mais une disposition à 2 colonnes gagnerait de la place — à arbitrer, le texte deviendrait serré.
- Utilisateurs mobile : « Désactiver » passe seul à la ligne sous « Modifier ». Cosmétique.
- Le cercle sombre « N » visible en bas à gauche des captures est l'**indicateur de développement Next.js**, absent en production.


## 2026-08-28 — Audit desktop + mobile sur les 4 profils, et correctifs

Audit conduit par captures réelles : 4 profils (direction, commercial, référent, direction générale) × 2 viewports (1440×900 et 390×844), sur toutes les pages. **66 captures**, avec relevé automatique des débordements horizontaux, erreurs console, réponses HTTP ≥ 400 et cibles tactiles sous 32 px.

### Défauts d'UX corrigés
- **Pages blanches** (`reporting/commercial/[id]`, `reporting/referent/[id]`) : `if (!currentProfile) return null` ne rendait rien pendant le chargement du profil, en violation de la règle zéro-flash. Structure affichée pendant le chargement, message « Accès non autorisé » explicite si le rôle ne convient pas.
- **Échecs silencieux** : `loadData` (reporting) et `fetchPlan` (planification) n'avaient aucun `try/catch` et étaient appelés sans `.catch()`. Un échec réseau laissait la page en chargement indéfini, sans message. C'est le même défaut que l'audit #8, corrigé à l'époque uniquement dans `CommercialReportingView` — la page principale avait été manquée.
- **`getAllProfiles` sans `.catch()`** (`utilisateurs`) : même conséquence.
- **Erreur confondue avec liste vide** (`notifications`) : le `catch` vidait la liste sans rien afficher.
- **Nouveau composant `components/ui/error-banner.tsx`** : bandeau unique, avec variante dark et bouton « Réessayer ». Employé par calendrier, reporting, planification, utilisateurs et notifications.

### Défauts trouvés par les captures
- **Débordement horizontal de 8 px sur `/fiches` en mobile** (direction et DG). Cause réelle : le conteneur `actions` passé à la `Topbar` ne se repliait pas ; avec le troisième bouton (Import CSV) il dépassait. `flex-wrap` ajouté aux 4 conteneurs d'actions. Les libellés d'export sont masqués sous `sm` (icône + `sr-only`), sinon le repli doublait la hauteur de l'en-tête, de 91 à 179 px.
- **Erreur HTTP 406 à chaque chargement du dashboard commercial** : `.single()` sur `objectifs_commerciaux` échoue quand aucun objectif n'existe. Remplacé par `.maybeSingle()`.
- **Erreurs HTTP 400 à chaque ouverture de fiche** : URL signées demandées pour des signatures inexistantes. Le dossier est désormais listé avant, et seuls les fichiers présents sont signés.
- **Filtres de période empilés un par ligne en mobile** (`/fiches`) : le conteneur avait `flex-1` et partageait sa ligne avec « Filtres avancés », d'où une colonne trop étroite — 8 lignes, ~330 px. Pleine largeur sous `sm` : 3 lignes, page raccourcie de 180 px.

### Cibles tactiles
Corrigées à la source dans le design system (`components/ui/button.tsx`) : les tailles `xs`, `sm`, `icon` et `icon-xs` passaient sous 32 px en mobile (`h-7` = 28 px). Relevées sous 640 px, densité desktop inchangée. Puces de filtre, recherche globale et petits contrôles textuels (15-20 px) relevés également.

### Vérifié sain, sans modification
Largeurs fixes, tableaux, grilles, noms accessibles des boutons icône, couverture dark mode : conformes. Le « N » sombre en bas à gauche des captures est l'indicateur de développement Next.js, absent en production.

### Résultat
**Aucun constat sur la passe finale** : zéro débordement, zéro erreur console, zéro erreur réseau, zéro cible sous 32 px, sur les 4 profils en desktop et mobile. Unitaires 51/51, e2e 17 PASS / 0 FAIL / 2 skipped, build vert.

### Incident d'environnement
Le dépôt a été déplacé de `~/Documents/…` (synchronisé iCloud) vers `~/Projets/proximite-habitat`. iCloud avait évincé 85 des 134 fichiers source (drapeau `dataless`) et corrompu `.git/refs/heads/main` en pleine session. Ne pas replacer un dépôt git dans un dossier synchronisé.


## 2026-08-28 — Purge des brouillons de test (fait)

Les **24 fiches `E2E-Test-*`** accumulées en base par les exécutions Playwright antérieures au nettoyage automatique ont été supprimées.

Précautions prises avant suppression :
- Sauvegarde JSON des 24 lignes complètes (répertoire temporaire de session, donc éphémère — les données n'ont aucune valeur métier).
- Vérifié que les 24 étaient **toutes** en `BROUILLON` et **toutes** préfixées `E2E-Test-`.
- Vérifié l'absence de `fiche_history`, `fiche_photos` et `notifications` liées (0 dans les trois cas).

Filtre appliqué : `status = 'BROUILLON' AND prospect_nom LIKE 'E2E-Test-%'`.

Après suppression : **0 fiche `E2E-Test-` restante**, base à 133 fiches dont 17 brouillons légitimes, intacts. Les prochaines exécutions ne laisseront plus de résidus grâce au `afterEach` de nettoyage.


## 2026-08-28 — `actionTimeout` global sur la suite Playwright

`playwright.config.ts` plafonnait le test (30 s) et les assertions `expect` (10 s), mais **pas les actions**. `actionTimeout` n'étant pas défini, sa valeur par défaut est `0` — soit **aucune limite**.

Conséquence : un `.click()` ou `.fill()` sur un locator introuvable n'échoue pas, il attend indéfiniment jusqu'à épuisement du budget du test. L'erreur remontée est alors `Test timeout of 30000ms exceeded`, qui désigne le test ou le hook — **jamais le locator fautif**. C'est ce qui a coûté deux itérations lors de l'écriture du nettoyage automatique : le vrai problème était un `aria-label` masquant le texte du bouton, mais rien dans le message ne le laissait deviner.

**Correctif** — `actionTimeout: 15_000` dans le bloc `use`. L'échec devient explicite :

```
locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '…' })
  at e2e/fiche-workflow.spec.ts:31
```

Vérifié par une spec jetable volontairement cassée : le message cite bien le locator, la ligne et le journal d'attente.

Portée : la suite compte 24 actions, dont 20 n'avaient aucun plafond. Les 4 `timeout:` locaux ajoutés la veille dans le hook de nettoyage sont devenus redondants et ont été retirés.

Aucun test qui passe ne change de comportement : le plafond ne se déclenche que sur un échec. Suite : **17 PASS / 0 FAIL / 2 skipped** sur deux passes, brouillons E2E stables à 24 (aucune accumulation).


## 2026-08-28 — Test e2e auto-nettoyant + migration SUPER_ADMIN appliquée

### Migration appliquée
`20260828_super_admin_transitions.sql` est **appliquée en base**. `SUPER_ADMIN` dispose désormais des mêmes transitions que `DIRECTION`, côté base comme côté client.

### Le test de brouillon ne pollue plus la base
Le test de création de brouillon écrivait une fiche en base **à chaque exécution**, sans jamais la supprimer : le stock est passé de 5 à 24 au fil de la journée.

Ajout d'un `test.afterEach` qui supprime le brouillon créé **via l'interface** — ce qui couvre au passage le parcours de suppression d'un brouillon par son auteur. Le nom de la fiche est mémorisé dès sa saisie, donc le nettoyage a lieu même si le test échoue en cours de route. Une erreur de nettoyage est signalée en `console.warn` sans faire échouer la suite.

Vérifié : 24 fiches avant, 24 après deux passes complètes — plus aucune accumulation.

### Deux pièges rencontrés, à retenir
- **`aria-label` masque le texte du bouton.** Le bouton de suppression affiche « Supprimer la fiche » mais porte `aria-label="Supprimer cette fiche"` : c'est ce dernier qui fait office de nom accessible. `getByRole("button", { name: "Supprimer la fiche" })` ne matchait donc rien.
- **Les actions Playwright n'ont pas de timeout par défaut** (`actionTimeout` non configuré = 0 = infini). Un `click()` sur un locator introuvable attend indéfiniment, jusqu'au timeout global du test — l'erreur remontée mentionne alors le hook, pas la ligne fautive. Tous les `click()` et `fill()` du hook portent désormais un timeout explicite.
- Un `afterEach` **partage le budget de temps du test** : `test.setTimeout()` est appelé dans le hook.

### Reste à faire
Purger les 24 brouillons de test accumulés avant ce correctif :
```sql
delete from fiches where status = 'BROUILLON' and prospect_nom like 'E2E-Test-%';
```


## 2026-08-28 — Correction de bugs hors périmètre d'audit

### 🔴 SUPER_ADMIN ne pouvait changer aucun statut de fiche — ⚠️ migration à appliquer
Le rôle `SUPER_ADMIN` (le compte `corinnediarra.cd@gmail.com`) était absent de la matrice de transitions **aux trois niveaux** : le RPC `transition_fiche` en base, `STATUS_TRANSITIONS` dans `permissions.ts`, et 15 gardes d'affichage dans `fiches/[id]/page.tsx`. Résultat : le bouton « Changer le statut » n'apparaissait pas, et toute transition aurait été refusée par la base. Incohérent avec le reste de l'application, où ce rôle a les pleins droits.

- **Nouvelle migration `supabase/migrations/20260828_super_admin_transitions.sql`** : `SUPER_ADMIN` ajouté aux 26 branches de la matrice qui autorisaient déjà `DIRECTION`. Signature inchangée (5 arguments, `p_montant_ht` conservé) donc simple `CREATE OR REPLACE`, sans `DROP` ni `GRANT`.
- **`permissions.ts`** : 17 branches de `STATUS_TRANSITIONS` enrichies ; `canAssignFiche` corrigé.
- **`fiches/[id]/page.tsx`** : booléen dérivé unique `isDirection` remplaçant les 15 tests `role === "DIRECTION"` épars.

### `canManageUsers` : fonction fausse, morte, et test en échec
`permissions.ts:25` ne renvoyait `true` que pour `SUPER_ADMIN`, alors que la garde réelle autorise aussi `DIRECTION` et `DIRECTION_GENERALE`. La fonction n'était appelée nulle part — la règle était dupliquée en clair dans `utilisateurs/page.tsx` — et son test unitaire échouait depuis avant cette session.

Remplacée par deux fonctions dont les noms disent ce qu'elles font, la distinction lecture/écriture étant réelle : `canAccessUsersPage` (dont le DG) et `canMutateUsers` (sans le DG). Employées aux 5 endroits de `utilisateurs/page.tsx` qui portaient la condition en clair. `isDirectionGenerale`, exporté et jamais appelé, supprimé.

### Un référent ne pouvait pas planifier les villes
`planification/page.tsx` — `isAdmin` excluait `PROSPECTEUR` : un référent pouvait éditer le tracé du parcours mais ni ajouter de villes, ni nommer le chef d'équipe. Renommé `canEditPlanification` et adossé au helper `canEditParcours`, une seule règle gouvernant désormais les deux (le nom `isAdmin` décrivait mal son contenu).

### Deux `<h1>` par page (accessibilité)
`Topbar` rendait `<h1>{title}</h1>` alors que 11 pages affichent déjà leur propre `<h1>` de hero — souvent avec le même texte. D'où la violation de mode strict rencontrée la veille, contournée par un locator scopé au `header`.

Prop `titleAs?: "h1" | "p"` ajoutée à `Topbar` (défaut `"h1"`, classes identiques : **aucun changement visuel**). Les 11 pages avec hero passent `titleAs="p"` ; les 4 sans hero (`calendrier`, `fiches/nouvelle`, `fiches/[id]`, `fiches/[id]/modifier`) gardent le défaut. **Chaque page a maintenant exactement un `<h1>`**, et les contournements ont été retirés des tests.

### Fixture de test obsolète (`validations/fiche.test.ts`)
Deux tests de `step1Schema` échouaient depuis avant cette session : le fixture `validStep1` datait d'une version antérieure du schéma, qui exige désormais `departement_code`, `ville_id`, `date_visite` et au moins une disponibilité. Les cas nominaux échouaient donc pour une raison sans rapport avec leur objet. Fixture complété.

### Fiabilisation
- Test « Import CSV » : attente du rendu de la page avant le bouton — il échouait par intermittence sous la charge de la suite complète.
- Test reporting : réaligné sur le `<h1>` du hero, le titre de la Topbar n'étant plus un heading.

### État
**Unitaires : 51/51.** **E2E : 17 PASS / 0 FAIL / 2 skipped**, stable sur deux passes. `tsc` 0 erreur, build vert.

### Reste à faire côté base
1. Appliquer `20260828_super_admin_transitions.sql` dans le SQL Editor Supabase.
2. Purger les 19 brouillons de test laissés par les exécutions e2e :
   ```sql
   delete from fiches where status = 'BROUILLON' and prospect_nom like 'E2E-Test-%';
   ```
   Vérifié : aucune `fiche_history`, `fiche_photos` ni `notifications` liée, et aucune fiche hors `BROUILLON` ne correspond au filtre.


## 2026-08-05 — Rectification : l'édition des parcours est ouverte aux 3 profils

**Correction d'une décision précédente.** L'édition des parcours hebdomadaires doit être accessible au **référent, au commercial et à la direction** — les trois profils parmi lesquels un chef d'équipe est nommé. La restriction à la direction seule, retenue plus tôt dans la journée, était une mauvaise compréhension de ma part.

### Ce qui change
- **`canEditParcours` extrait dans `lib/permissions.ts`** en fonction pure et documentée. Elle autorise `PROSPECTEUR`, `COMMERCIAL`, `DIRECTION`, plus `CHEF_EQUIPE` et `SUPER_ADMIN`. `DIRECTION_GENERALE` reste exclu (lecture seule).
- **`planification/page.tsx`** consomme désormais ce helper au lieu d'une condition inline.
- **Le correctif d'audit #9 est donc annulé** : il retirait `COMMERCIAL` de l'édition des parcours, ce qui était contraire au métier.

### Tests
- **4 tests unitaires** ajoutés dans `permissions.test.ts` : les trois profils, le rôle historique, l'exclusion du DG, le rôle absent.
- **Test e2e d'audit #9 retiré.** La carte n'est rendue que s'il existe une planification pour la semaine affichée — et il n'y en a aucune pour la semaine courante. Un test e2e aurait donc dépendu des données du moment. La règle est couverte de façon déterministe par le test unitaire.
- Suite e2e : **17 PASS / 0 FAIL / 2 skipped**. Build vert, `tsc` 0 erreur.

### Signalé au passage
`canManageUsers` (`lib/permissions.ts:25`) renvoie `true` uniquement pour `SUPER_ADMIN`, alors que son test unitaire attend `true` pour `DIRECTION`. **Échec préexistant** — la fonction est identique au commit `05efc02`, antérieur à cette session — et **la fonction n'est utilisée nulle part** dans l'application : le contrôle d'accès réel vit dans `utilisateurs/page.tsx`. Code mort à trancher (corriger la fonction ou la supprimer avec son test).


## 2026-08-05 — Chef d'équipe : le sélecteur de planification ne proposait presque personne

### Le constat métier
Le chef d'équipe **n'est pas un profil à part entière** : c'est un référent, un commercial ou, exceptionnellement, un membre de la direction, nommé pour une semaine via `planification_hebdo.chef_equipe_id`.

Le schéma respecte déjà cette règle — `chef_equipe_id` est une simple clé étrangère vers `profiles`, **sans contrainte de rôle**. C'est la requête de l'interface qui était fautive.

### Correctif (`planification/page.tsx`)
Le sélecteur « Chef d'équipe » ne proposait que les profils de rôle `CHEF_EQUIPE` — il n'en existe **qu'un seul en base** (`CE@gmail.com`, compte de test). Le sélecteur était donc quasi vide et la fonctionnalité inutilisable.

Il propose désormais les `PROSPECTEUR`, `COMMERCIAL` et `DIRECTION` actifs, plus le rôle `CHEF_EQUIPE` historique pour compatibilité. Mesuré : **de 0–1 candidat à 19 et 11 selon la succursale**.

Deux points au passage :
- **Filtre par organisation ajouté** : la requête n'en avait aucun. Élargie sans ce filtre, elle aurait listé les profils de toutes les succursales. Elle est désormais bornée à `parcoursOrg`, comme les requêtes voisines.
- Tri par nom de famille ajouté.

### Décision : `canEditParcours` reste à la direction
Question posée, réponse retenue : seules `DIRECTION` et `SUPER_ADMIN` (plus le rôle `CHEF_EQUIPE`) éditent les parcours. **Le correctif d'audit #9 est donc confirmé, il n'y a pas de régression** : un commercial nommé chef d'équipe est bien désigné dans la planification, mais ne modifie pas le tracé.

À noter : `isAdmin` (ligne 93) inclut toujours `COMMERCIAL`, ce qui gouverne l'édition des **villes** planifiées — distinct de l'édition du **parcours**. Non modifié, hors du périmètre de la décision.

### Tests
- **Test « dashboard du CHEF_EQUIPE » (audit #1) retiré** : sa prémisse était fausse, il n'existe pas de compte dédié à tester. Constante `CHEF_EQUIPE` retirée des helpers.
- Le correctif d'audit #1 dans `page.tsx` (ajout de `CHEF_EQUIPE` à `isReferent`) **est conservé** : le rôle existe toujours dans l'enum et dans `permissions.ts` (8 usages), un compte le porte.
- Suite : **18 PASS / 0 FAIL / 2 skipped** (DG et objectifs, tous deux gated par variable d'environnement).


## 2026-08-05 — Suite e2e remise au vert : 18 PASS / 0 FAIL

Diagnostic des 8 échecs préexistants. **Un vrai défaut applicatif, le reste des tests écrits contre une UI qui n'existe pas (ou plus).**

### Correctif applicatif
- **`/offline` inaccessible sans session** (`lib/supabase/middleware.ts`) : la route n'était pas dans les chemins publics, donc une visite non authentifiée était redirigée vers `/login` — une page qui exige justement le réseau. Le repli hors ligne de la PWA était donc cassé pour un utilisateur déconnecté. `/offline` ajouté aux chemins publics.

### Tests qui visaient du texte inexistant
- **« Funnel de conversion » et « Objectifs du mois »** n'existaient que dans des **commentaires du source**, jamais rendus — ces tests ne pouvaient pas passer. Réécrits sur les titres réels (`Reporting direction`, `Répartition par statut`, `Taux d'acceptation`).
- **« Objectifs du mois »** visait `/reporting` alors que la carte vit sur le dashboard COMMERCIAL. De plus `CommercialObjectifs` retourne `null` sans ligne dans `objectifs_commerciaux`, table vide ici : test gated par `E2E_WITH_OBJECTIFS=1` plutôt qu'un skip conditionnel qui serait vert sans rien vérifier.
- **Heading « Connexion »** : le titre du formulaire est « Bon retour ».
- **`p.text-destructive`** : l'erreur est rendue dans un `<div>`, pas un `<p>`.
- **« Étape 1 »** : le stepper affiche « Chapitre 1 sur 7 ».
- **Heading `/PHC-/`** sur le détail : le `<h2>` porte le nom du prospect, la Topbar « Détail de la fiche ».

### Bugs de test réels
- **Le workflow ne soumettait jamais la fiche.** « Soumettre » n'est pas atteignable depuis le chapitre 1 (les 7 chapitres sont requis, signature comprise), et le garde `if (await submitBtn.isVisible())` masquait l'absence de clic. Les fiches restaient en `BROUILLON`, donc l'assertion sur la liste `SOUMISE` ne pouvait pas passer. Test recentré sur ce que le parcours produit vraiment : création d'un brouillon, plus un test distinct pour l'accès admin à la file de validation.
- **Aucune déconnexion entre deux comptes** : `goto("/login")` sur une session active est redirigé vers `/` par le middleware, le formulaire n'apparaît jamais. Helper `logout()` ajouté (cookies + storage).
- **Les boutons « Sauvegarder » n'émettent aucun toast** (`saveDraft({ silent: true })`) : l'assertion porte désormais sur l'horodatage « Sauvegardé à HH:MM ».
- **Sélecteurs ambigus** : `getByRole(name)` matche en sous-chaîne — « Fiches » attrapait « Statut des Fiches » et « Fiches à valider » (navigation non déterministe), « Toutes » attrapait « Toutes les dates ». Navigation explicite et `exact: true`.
- **Attente manquante** sur la liste des fiches : assertion sur le compteur avant les cartes.

### Reste à traiter
- **Deux `<h1>` identiques** sur `/fiches` (Topbar + hero). Contourné par un locator scopé au `header`, mais c'est un défaut d'accessibilité à corriger dans le markup.
- **Fiches de test résiduelles** : les exécutions du workflow ont laissé des brouillons `E2E-Test-*` en base. À supprimer si souhaité — je ne l'ai pas fait de moi-même.

## 2026-08-05 — Tests e2e des correctifs de rôles

### Nouvelle spec `e2e/roles.spec.ts`
Couvre les correctifs de périmètre par rôle de l'audit. **5 tests passent, stables sur 3 passes consécutives** :
- #9 — un COMMERCIAL ne voit aucune action d'édition de parcours sur `/planification`
- #20 — un PROSPECTEUR ne voit pas le bouton Import CSV ; une DIRECTION le voit
- #6 — une DIRECTION non-DG ne voit pas le sélecteur « Toutes les succursales »
- #5 — la confirmation d'acceptation reste désactivée sans montant HT, et s'active dès qu'un montant valide est saisi (test non mutant : on ne confirme pas)

2 tests ignorés faute de comptes : #1 (CHEF_EQUIPE) et #10 (DIRECTION_GENERALE). Ils s'activent via `E2E_CHEF_EQUIPE_EMAIL/_PASSWORD` et `E2E_DG_EMAIL/_PASSWORD` — volontairement pas de mot de passe versionné pour ces comptes réels.

### Bugs corrigés dans l'outillage de test
- **`e2e/helpers.ts`** : le helper `login` attendait le texte « Bonjour », mais le dashboard affiche « Bonjour / Bon après-midi / Bonsoir » selon l'heure. **Toute la suite e2e ne pouvait donc passer que le matin.** Constante `GREETING_RE` introduite et utilisée aussi dans `auth.spec.ts`.
- Comptes `PROSPECTEUR` et `COMMERCIAL_AVEC_FICHES` (`commercial2@phc.fr`, qui porte des fiches AFFECTEE) ajoutés aux helpers.
- Suppression de `scripts/_audit_full.mjs` et `scripts/_check_404.mjs` : scripts ad hoc de l'audit, avec un mot de passe en dur dans le source.

### État des specs préexistantes
`auth`, `navigation` et `fiche-workflow` comptent 8 échecs. **Vérifié qu'ils sont antérieurs à cette session** : la même suite rejouée avec le `src/` du commit `05efc02` donne exactement le même résultat (5 PASS / 8 FAIL). Sélecteurs obsolètes (heading « Connexion », `p.text-destructive`, « Étape 1 », « Funnel de conversion », « Objectifs du mois », « Vous êtes hors ligne ») et une violation de mode strict sur « Fiches de pré-visite », présent en double dans le header et la page. **À reprendre dans une session dédiée.**

## 2026-08-05 — Migration montant HT appliquée : retrait du code de repli

- **Migration `20260805_montant_ht_obligatoire.sql` appliquée en base.** Vérifié via trois appels PostgREST (3, 4 et 5 arguments nommés) : tous résolvent vers la nouvelle fonction, aucune erreur `PGRST202` ni ambiguïté de surcharge `PGRST203`.
- **`handleStatusChange`** (`fiches/[id]/page.tsx`) : suppression du repli (double appel RPC + `UPDATE montant_ht` séparé) devenu inutile. Un seul appel `transition_fiche` avec `p_montant_ht`, le montant est écrit par le RPC.
- **Message d'erreur ajusté** : pour `ACCEPTEE`, seule la ligne d'historique peut désormais échouer — le toast ne demande plus de ressaisir un montant qui est bel et bien enregistré (`toast.warning` au lieu de `toast.error`).

## 2026-08-05 — Fin d'audit : lot polish (bundle, cache par rôle, mobile)

### Bundle
- **`canvas-confetti` en import dynamique** (`fiches/[id]/page.tsx`) : chargé uniquement au passage en `ACCEPTEE`, plus au chargement de la page détail. Vérifié : la lib est désormais isolée dans son propre chunk de 12 Ko.

### Cache localStorage par rôle
- **Nouveau helper `getCachedProfileRole()`** (`lib/utils.ts`) : lit le rôle depuis `ph_profile_v1`, ce qui permet de construire la clé de cache avant même le rechargement du profil.
- **Clés enrichies du rôle** sur les trois pages à cache : `dash_cache_${id}_${role}` (`page.tsx`), `rpt_cache_${id}_${role}` (`reporting/page.tsx`), `fiches_cache_${id}_${role}_${status}` (`fiches/page.tsx`). Avant, un utilisateur changeant de rôle restaurait le cache de l'ancien rôle (sections et périmètre de fiches différents). Effet de bord attendu : un chargement à froid une seule fois après déploiement.

### Mobile
- **Filtres de statut** (`fiches/page.tsx`) : sur mobile, rangée unique en scroll horizontal (`overflow-x-auto` + `shrink-0`) au lieu de 4-5 lignes de boutons empilées sur 375 px. À partir de `sm`, retour au `flex-wrap` classique — nécessaire car `overflow-x-auto` clippe les tooltips au survol (sans conséquence sur tactile, où le survol n'existe pas).

### Calendrier
- **Stale-while-revalidate** (`calendrier/page.tsx`) : `setLoading(true)` n'est plus déclenché qu'au premier chargement (`hasLoadedOnceRef`). Une navigation mois/semaine ne repasse plus par l'état vide « Aucun rendez-vous » entre deux périodes. Note : conserver les events du mois précédent en opaque n'est pas applicable — `eventsByDay` filtre sur la nouvelle plage de dates, donc les anciens events disparaissent de toute façon.

## 2026-08-05 — Suite audit : montant HT obligatoire en base, vue DG globale, tri calendrier

### Montant HT obligatoire (audit #5) — ⚠️ migration à appliquer
- **Nouvelle migration `supabase/migrations/20260805_montant_ht_obligatoire.sql`** : `transition_fiche` prend un 5ᵉ paramètre `p_montant_ht`. Le passage en `ACCEPTEE` lève une exception si `coalesce(p_montant_ht, fiches.montant_ht, 0) <= 0`, et le montant est écrit dans le même `UPDATE` que le statut. L'ancienne signature à 4 arguments est supprimée (`drop function`) pour éviter une surcharge ambiguë côté PostgREST.
- **Client** (`fiches/[id]/page.tsx`) : `handleStatusChange` envoie `p_montant_ht` avec la transition. Repli automatique sur l'ancien appel + `UPDATE` séparé tant que la migration n'est pas appliquée, donc le déploiement front peut précéder la migration sans casse.
- **Types** (`types/database.types.ts`) : `p_montant_ht` ajouté à la signature `transition_fiche`.
- L'UI bloquait déjà la confirmation sans montant > 0 (`FicheStatusChangeDialog`) ; la règle est désormais garantie côté base, y compris pour un appel direct à l'API.

### Vue DG « toutes les succursales »
- **Reporting** (`reporting/page.tsx`) : la requête `planification_hebdo` filtrait sur `profile.organization_id` en vue globale → seules les villes du siège remontaient. Plus de filtre organisation en vue globale DG (la RLS borne la visibilité).
- **Planification** (`planification/page.tsx`) : même correctif sur l'historique des parcours (`parcours_hebdo`) et sur la requête `planification_hebdo` associée.

### Cohérence des chiffres
- **Dashboard COMMERCIAL** (`page.tsx`) : `caTotal` et `mesVentes` étaient écrits deux fois (bloc `ventes` puis bloc `commAcceptees`) avec des jeux de données différents. La requête `ventes` n'est plus émise pour le rôle COMMERCIAL — `commAcceptees` est la source unique, ce qui supprime aussi une requête par chargement.
- **Calendrier** (`calendrier/page.tsx`) : en mode « Tous », la requête n'a pas de `.order()` (filtre `or` sur deux colonnes de date) → ordre non déterministe dans une journée. Tri par heure puis par nom appliqué dans `eventsByDay` ; le tri redondant de la grille mensuelle est supprimé.

## 2026-08-05 — Suite audit : fiabilité transitions, borne requête ventes, fetch dédoublonné

### Fiabilité des données
- **Motif de refus / montant HT / date RDV** (`fiches/[id]/page.tsx`) : les écritures complémentaires exécutées après le RPC `transition_fiche` sont désormais dans un try/catch. Si le réseau coupe entre la transition (réussie) et l'enregistrement du complément, un toast explicite invite l'utilisateur à ressaisir la donnée au lieu de la perdre silencieusement.

### Performance
- **Requête ventes dashboard** (`page.tsx`, ~L.290) : ajout de `.order("updated_at", desc).limit(1000)`. Avant, toutes les fiches `ACCEPTEE` étaient rapatriées sans borne explicite pour l'agrégation client (CA, ventes par référent/commercial).
- **Double fetch fiche détail** (`fiches/[id]/page.tsx`) : `realtime` et `visibilitychange` déclenchaient deux `fetchData()` concurrents, donc deux séries de `createSignedUrl` sur toutes les photos. Ajout d'un `scheduleRefetch` debouncé à 200 ms partagé par les deux sources, avec nettoyage du timer au démontage.

## 2026-08-05 — Suite audit : fiche introuvable + export CSV complet

### UX / robustesse
- **Fiche introuvable** (`fiches/[id]/page.tsx`) : séparation loading vs fiche=null — affiche désormais un état "Fiche introuvable" clair avec bouton retour au lieu d'une page vide blanche. Import `FileText` ajouté.

### Export CSV
- **Export CSV fiches** (`fiches/page.tsx` + `lib/data/fiches.ts`) : l'export respecte maintenant tous les filtres actifs : période (customFrom/customTo ou periodFilter), référent, commercial, ville, département, succursale. Avant : seuls statusFilter, search et isReferent étaient transmis.

## 2026-08-05 — Audit multi-profils : 11 corrections bugs, sécurité et cohérence

### Sécurité / accès par rôle
- **DIRECTION_GENERALE lecture seule dans /utilisateurs** : bouton "Nouvel utilisateur" masqué + guards dans handleCreateUser, handleToggleActive, handleEditUser
- **COMMERCIAL ne peut plus modifier la planification** : retiré de `canEditParcours` dans planification/page.tsx
- **Calendrier : filtre organization_id manquant pour DIRECTION** : un DIRECTION non-DG voit maintenant uniquement les RDV de son org (calendrier/page.tsx)
- **Import CSV masqué pour PROSPECTEUR** : bouton ImportCsvDialog limité à isAdminOrDG (fiches/page.tsx)

### Exactitude des données
- **CHEF_EQUIPE invisible sur le dashboard** : ajout de `|| CHEF_EQUIPE` dans la définition de `isReferent` (2 occurrences dans page.tsx)
- **Compteurs de statut cohérents avec le filtre de période** : `countPromises` applique maintenant les mêmes filtres date/référent/commercial que la requête principale (fiches/page.tsx)
- **Cache CommercialReportingView différencié par viewer** : clé `rpt_cache_${viewerProfileId}_${subjectId}` — la direction qui consulte le rapport d'un commercial ne pollue plus son cache (CommercialReportingView.tsx + appels)
- **Export CSV utilisateurs respecte le filtre succursale** : utilise `branchScopedUsers` au lieu de `users` (utilisateurs/page.tsx)

### Robustesse / UX
- **Suppression brouillon avec try/catch** : toast d'erreur si la suppression échoue, le dialog ne se ferme plus (page.tsx)
- **Spinner infini CommercialReportingView sur erreur réseau** : `.catch(() => { setLoading(false); setRefreshing(false); })` ajouté (CommercialReportingView.tsx)
- **Cache reporting période vide sauvegardé** : `saveRptCache()` appelé avec valeurs à zéro avant le early return — plus de flash au rechargement (reporting/page.tsx)

### Design
- **Couleur RETRACTATION unifiée** : `#ec4899` (pink) → `#8b5cf6` (violet) dans les graphiques reporting pour correspondre au dashboard

## 2026-08-03 — Audit responsive : 6 corrections desktop + mobile

### P1 CRITIQUE — Layout cassé sur mobile (375px)
- **Tableau succursales** (`reporting/page.tsx`) : ajout breakpoint `sm:` — colonnes Refusées + CA HT masquées sur mobile (`hidden sm:block`), grille mobile `grid-cols-[1fr_48px_48px_50px]` vs desktop `[1fr_56px_56px_56px_72px_80px]`
- **Barre de contrôles calendrier** (`calendrier/page.tsx`) : input recherche `w-64` → `w-full sm:w-64` ; select commercial `w-[220px]` → `w-full sm:w-[220px]`
- **Grille statuts dashboard** (`page.tsx`) : `grid-flow-col auto-cols-fr` → `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-flow-col xl:auto-cols-fr` (7 cartes = 53px/carte sur 375px, illisible)

### P2 IMPORTANT — Dégradation UX sur mobile
- **Tableau CA commercial** (`page.tsx`) : colonne Date masquée sur mobile (`hidden sm:block`), grille `[1fr_100px]` mobile vs `[1fr_100px_100px]` desktop
- **Tableau commerciaux** (`AdminKpiSection.tsx`) : colonne « CA moy. » masquée sur mobile, grille `[1fr_60px_80px]` mobile vs `[1fr_60px_80px_60px]` desktop

### P3 MINEUR — UX calendrier 7 jours sur mobile
- **Grille calendrier mensuel** (`calendrier/page.tsx`) : ajout `overflow-x-auto` sur le container + wrapper `min-w-[420px]` pour scroll propre sur petits écrans

## 2026-08-03 — Calendrier : nouveau bouton « Tous » (RDV commerciaux + techniciens)

### Ajout d'un 3e mode de vue « Tous » dans le calendrier
- Avant : le calendrier alternait entre RDV commerciaux (bouton Commercial, `rdv_date` : visites, validations, acceptations) et RDV techniciens (bouton Technicien, `rdv_technicien_date`). Impossible de voir les deux sur le même mois → un commercial n'ayant que des RDV technicien voyait un calendrier vide en mode Commercial par défaut.
- Ajout d'un bouton « Tous » (couleur violet, à côté de Commercial/Technicien) qui affiche les deux types de RDV simultanément, avec un code couleur distinct par type (bleu pour commercial selon statut, sky/bleu ciel pour technicien).
- Refactor interne : `fichesByDay` remplacé par `eventsByDay` (map de `RdvEvent { fiche, kind, date, heure }`) — permet à une même fiche d'apparaître deux fois si elle a un RDV commercial ET un RDV technicien dans la période.
- Modal jour : chaque événement porte son étiquette « RDV Technicien » quand applicable ; le bouton « Modifier la date » ne s'affiche que sur les événements commerciaux (car il modifie `rdv_date`).
- Requête Supabase adaptée : mode `all` utilise `.or()` pour récupérer fiches ayant rdv_date OU rdv_technicien_date dans la plage, avec l'union des statuts pertinents.
- Fichier : `src/app/(dashboard)/calendrier/page.tsx`

### Revert commit précédent
- Retour arrière du commit `90e4973` (« Affiche la date et l'heure du RDV technicien sur la carte de fiche ») : la carte fiche `/fiches` réaffiche `created_at` comme avant, l'info horaire du RDV est désormais accessible via le calendrier avec le bouton « Tous ».

## 2026-08-03 — Fix placeholder tronqué dans la barre de recherche du calendrier

### Champ de recherche élargi
- Le placeholder « Rechercher un RDV… » (140px) dépassait l'espace utilisable du champ (128px avec icône + bouton d'effacement), causant une troncature visuelle
- Largeur du champ passée de `w-48` (192px) à `w-64` (256px) — espace utilisable désormais 192px, confortable
- Fichier : `src/app/(dashboard)/calendrier/page.tsx`

## 2026-08-03 — Période toujours visible + message si aucune fiche (reporting)

### Période active toujours affichée dans les titres de carte
- Avant : quand le filtre « Toutes les dates » était sélectionné, le suffixe de période était vide (aucune indication visuelle) — seuls les filtres précis (Ce mois, Cette semaine...) affichaient une période
- Après : `periodSuffix` affiche toujours un texte, avec repli sur le libellé court (`PERIOD_LABELS[periodFilter]`, ex. « Toutes les dates ») quand le libellé détaillé n'existe pas
- S'applique à tous les titres de carte du reporting (direction et commercial) qui utilisaient déjà `periodSuffix`, pas seulement « Répartition des fiches par statut »
- Fichiers : `reporting/page.tsx`, `CommercialReportingView.tsx`

### Message explicite si aucune fiche sur la période
- Le graphique « Répartition des fiches par statut » (`ConversionFunnel.tsx`) était entièrement masqué (`{totalFiches > 0 && ...}`) quand aucune fiche ne correspondait à la période sélectionnée — remplacé par un message « Aucune fiche sur la période sélectionnée » à l'intérieur du composant, qui reste désormais toujours monté
- Fichiers : `ConversionFunnel.tsx`, `reporting/page.tsx`, `CommercialReportingView.tsx`

## 2026-08-03 — Inversion cartes tableau de bord + boutons calendrier élargis

### Tableau de bord direction : « CA par commercial » déplacé à gauche
- Échange de position entre « CA par commercial » et « Objectif mensuel de prime » dans la grille 2 colonnes
- Fichier : `src/components/dashboard/AdminKpiSection.tsx`

### Calendrier des RDV : boutons élargis + couleur active Mois/Semaine
- Liste déroulante « Tous les commerciaux » élargie (180px → 220px) pour éviter la troncature du texte
- Boutons Commercial/Technicien : padding horizontal augmenté (px-3 → px-4) + `whitespace-nowrap`
- Boutons Mois/Semaine : même élargissement, et état actif désormais coloré en orange (`#F97316`, identique au bouton Commercial) au lieu d'un simple fond gris peu visible
- Fichier : `src/app/(dashboard)/calendrier/page.tsx`

## 2026-08-03 — Fix label tronqué à droite des graphiques + flèches plus visibles

### Dernier label de l'axe X tronqué (toutes granularités)
- Le label du point le plus à droite (période en cours) était partiellement coupé par le bord arrondi de la carte (ex. « S2 202... », « T3 202... »)
- Cause : chaque label Recharts est centré sur son point (`textAnchor="middle"`), et pour le dernier point (en bord de zone de tracé), la moitié droite du texte débordait au-delà de la marge du graphique (`margin.right` insuffisant à 10px)
- Fix : `margin.right` augmenté à 55px sur les 3 graphiques hebdomadaires/évolution concernés — testé avec le label le plus large (« 03 août - 09 août ») qui reste maintenant à ~14px de la bordure du SVG
- Fichiers : `EvolutionChart.tsx`, `reporting/page.tsx` (Tendance hebdo direction), `CommercialReportingView.tsx` (Tendance hebdo commercial)

### Flèches de navigation plus visibles
- Couleur changée de gris clair (`border-border text-muted-foreground`) vers l'orange de marque `#F97316` déjà utilisé pour les éléments interactifs actifs ailleurs dans l'app
- Mêmes 3 fichiers, état désactivé toujours grisé via `disabled:opacity-30`

## 2026-08-03 — Fenêtre glissante de 8 semaines avec navigation (granularité Semaine)

### Remplacement de la vue compressée (31 semaines) par une fenêtre de 8 semaines paginée
- Avant : granularité Semaine affichait les ~31 semaines depuis janvier compressées sur l'axe, avec seulement 8 labels espacés régulièrement (`pickEvenTicks`) — jugé difficile à lire
- Après : seules 8 semaines réelles sont affichées à la fois (semaine en cours + 7 précédentes par défaut), chacune avec son propre label d'axe — plus de compression, plus d'espacement calculé nécessaire
- Navigation par flèches `◀ ▶` (sans étiquette de période ni bouton retour) : `◀` recule d'une semaine à la fois jusqu'au 1er janvier (désactivée à la butée), `▶` avance vers le présent (désactivée à la semaine courante)
- Changer de granularité (ex. Semaine → Mois) réinitialise la fenêtre à la semaine courante
- Appliqué aux 3 graphiques hebdomadaires : `EvolutionChart.tsx` (composant partagé, prop interne `weekOffset`), Tendance globale hebdomadaire direction (`reporting/page.tsx`) et commercial (`CommercialReportingView.tsx`), chacun avec son propre state `weeklyTrendOffset`
- Le calcul des données reste inchangé (toujours généré depuis le 1er janvier) — seul l'affichage est fenêtré, donc toutes les semaines de l'année restent accessibles via la navigation

## 2026-08-03 — Fix espacement irrégulier des labels d'axe (illusion de trou mi-juillet/août)

### Espacement régulier des labels de l'axe X (granularités denses)
- Le fix précédent (`interval="preserveStartEnd"`) forçait le premier ET le dernier label mais espaçait le reste automatiquement, créant un écart final anormalement grand (4 semaines) par rapport aux autres écarts (2-3 semaines) — donnait l'illusion que des semaines manquaient entre mi-juillet et le 3 août, alors que les données étaient continues
- Nouvelle fonction utilitaire `pickEvenTicks(labels, maxTicks=8)` dans `EvolutionChart.tsx` : sélectionne des indices régulièrement espacés (pas fixe, incluant toujours le premier et le dernier point) et les passe explicitement via la prop `ticks` de Recharts (`interval={0}` pour désactiver le recalcul automatique)
- Résultat vérifié : écarts homogènes de 4-5 semaines sur toute la plage, y compris le dernier segment
- Appliqué aux 3 graphiques hebdomadaires : `EvolutionChart.tsx` (composant partagé), Tendance globale hebdomadaire direction (`reporting/page.tsx`) et commercial (`CommercialReportingView.tsx`)

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
