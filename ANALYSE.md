# Analyse complète — Proximité Habitat Conseil

> Application de gestion des **fiches de pré-visite** pour la rénovation énergétique.
> Document généré le **6 juin 2026** — mis à jour le **6 juin 2026** après implémentation complète des Lots 1 à 4.

---

## ⚡ Résumé de l'état courant (juin 2026)

| Lot | Périmètre | Statut |
|---|---|---|
| **Lot 0** | Fondations (Next.js, Supabase, seed) | ✅ Complet |
| **Lot 1** | Auth, profil, mot de passe oublié | ✅ Complet |
| **Lot 2** | Wizard 7 étapes, brouillons, photos | ✅ Complet |
| **Lot 3** | Workflow, édition, commentaires | ✅ Complet |
| **Lot 4** | Notifs realtime, PDF, reporting, filtres | ✅ Complet |
| **Lot 5** | Industrialisation (RLS, tests, CI/CD) | 🟡 En cours |

---

## 1. Vue d'ensemble

**Proximité Habitat** est une application web interne (SaaS multi-tenant) destinée à une entreprise de rénovation énergétique. Elle permet aux **prospecteurs** de saisir sur le terrain des fiches de pré-visite (coordonnées du prospect, caractéristiques du logement, chauffage, ventilation, isolation, photos, signature), puis à la **direction** de les valider et de les **affecter à des commerciaux** qui les acceptent ou les refusent.

Le cœur du produit est un **workflow de statuts** autour d'une entité unique : la *fiche*.

```
BROUILLON → SOUMISE → AFFECTEE → ACCEPTEE → ARCHIVEE
                                → REFUSEE  → ARCHIVEE
```

---

## 2. Analyse technique

### 2.1 Stack

| Couche | Technologie | Version |
|---|---|---|
| Framework | **Next.js** (App Router, RSC) | 16.2.7 |
| UI runtime | React | 19.2.4 |
| Langage | TypeScript | 5.x |
| Backend / DB / Auth / Storage / Realtime | **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) | 2.107 |
| Styling | **Tailwind CSS v4** + `tw-animate-css` | 4.x |
| Composants | **shadcn** (style `base-nova`) + `@base-ui/react` | — |
| Formulaires | `react-hook-form` + `@hookform/resolvers` | 7.77 |
| Validation | **Zod** | 4.4 |
| Toasts | `sonner` | 2.0 |
| Icônes | `lucide-react` | — |
| Thèmes | `next-themes` (installé, non utilisé) | 0.4 |

### 2.2 Architecture applicative

- **Rendu** : majoritairement **client-side** (`"use client"`). Les pages métier (dashboard, liste, détail, stepper, utilisateurs, notifications) sont des composants client qui interrogent Supabase depuis le navigateur via la clé `anon`.
- **Auth & garde de routes** : `src/middleware.ts` → `updateSession()`. Redirige vers `/login` si non authentifié, et vers `/` si déjà connecté sur `/login`. C'est la **seule** protection côté serveur des routes.
- **Groupes de routes** :
  - `(auth)` → `/login`
  - `(dashboard)` → `/`, `/fiches`, `/fiches/nouvelle`, `/fiches/[id]`, `/utilisateurs`, `/notifications`
- **API Route** : une seule, `POST /api/users` — création d'utilisateur côté serveur via `service_role` (vérifie que l'appelant est ADMIN et que l'organisation correspond). C'est le **seul** endroit où une règle métier est appliquée côté serveur.
- **Clients Supabase** : `client.ts` (navigateur), `server.ts` (RSC + `createServiceClient`), `middleware.ts` (refresh session).
- **Temps réel** : le dashboard s'abonne aux `postgres_changes` de la table `fiches` et se rafraîchit automatiquement.

### 2.3 Modèle de données (déduit du code — voir §6 ⚠️)

Tables Supabase référencées dans le code :

- `organizations` (`id`, `name`, `slug`)
- `profiles` (`id` = auth.uid, `organization_id`, `email`, `first_name`, `last_name`, `role`, `phone`, `is_active`, `created_at`, `updated_at`)
- `fiches` (~35 colonnes : identité prospect, logement, chauffage, ventilation, isolation, toiture, `status`, `reference`, `created_by`, `assigned_to`, `consentement_rgpd`, `signature_url`, timestamps…)
- `fiche_history` (`fiche_id`, `user_id`, `action`, `old_status`, `new_status`, `comment`, `created_at`)
- `fiche_photos` (`fiche_id`, `storage_path`, `original_name`, `size`)
- `notifications` (`user_id`, `type`, `title`, `message`, `fiche_id`, `read`, `created_at`)
- Buckets Storage : `photos`, `signatures`

**Rôles** : `ADMIN` (Direction), `COMMERCIAL`, `PROSPECTEUR`.

### 2.4 Logique métier — `src/lib/permissions.ts`

- Matrice de **transitions de statut** par rôle (`STATUS_TRANSITIONS`, `canTransition`, `getAvailableTransitions`).
- Helpers `canManageUsers`, `canAssignFiche`, `canEditFiche`.
- Labels et couleurs centralisés (`STATUS_LABELS`, `STATUS_COLORS`, `ROLE_LABELS`).

⚠️ **Cette logique est exécutée uniquement côté client** (sauf l'API users). Elle masque/affiche des boutons mais **n'empêche pas** un utilisateur malveillant d'appeler directement Supabase. La sécurité réelle repose donc **entièrement sur les politiques RLS** de la base — qui ne sont **pas versionnées dans le dépôt** (voir §6).

### 2.5 Formulaire de saisie — `FicheStepper.tsx`

- Wizard **7 étapes** : Coordonnées → Habitation → Chauffage → Ventilation → Isolation & Toiture → Photos & Notes → Signature.
- **Pas de resolver Zod** sur le formulaire : la validation Zod n'est appliquée **qu'à la soumission finale** (et ne contrôle réellement que l'étape 1 + le consentement RGPD).
- **Auto-save** toutes les 30 s si le formulaire est « dirty » ; bouton « Sauvegarder » manuel ; sauvegarde aussi au passage d'étape.
- **Référence** générée côté client (`PHC-AAAAMMJJ-HHMMSS+random`) → risque de collision, non garantie par la base.
- **Photos** conservées en mémoire (`File[]`) et uploadées **seulement à la soumission** → perdues si la page est rechargée avant soumission, même après sauvegarde du brouillon.
- **Signature** : canvas maison (souris + tactile), exportée en PNG, uploadée à la soumission.

---

## 3. Analyse structurelle

```
src/
├── middleware.ts                    # Garde d'auth globale
├── types/database.ts                # UserRole, FicheStatus (types seulement)
├── lib/
│   ├── permissions.ts               # RBAC + labels (client-side)
│   ├── utils.ts                     # cn()
│   ├── validations/fiche.ts         # Schémas Zod + constantes métier
│   ├── hooks/use-profile.ts         # Hook profil courant
│   └── supabase/{client,server,middleware}.ts
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── page.tsx                 # Dashboard (compteurs + récentes + temps réel)
│   │   ├── fiches/{page,[id],nouvelle}
│   │   ├── utilisateurs/page.tsx    # ADMIN uniquement
│   │   └── notifications/page.tsx
│   └── api/users/route.ts
└── components/
    ├── ui/                          # ~20 primitives shadcn
    ├── forms/{FicheStepper, SignatureCanvas, steps/Step1..7}
    ├── layout/{Sidebar, Topbar}
    └── fiches/FicheStatusBadge
```

**Points forts structurels**
- Séparation claire `app` / `components` / `lib`.
- RBAC centralisé en un seul fichier.
- Constantes métier (modes de chauffage, isolants, toiture…) regroupées avec les schémas Zod.
- Conventions Next 16 respectées (`params` en `Promise`, route groups, `force-dynamic`).

**Faiblesses structurelles**
- **`database.ts` ne contient pas les types des tables** (juste deux unions). Les formes de `Fiche`, `Profile`, etc. sont **redéclarées à la main** dans chaque page (ex. interface `Fiche` de 35 champs dans `[id]/page.tsx`, dupliquée partiellement dans le dashboard). Pas de types générés Supabase → désynchronisation garantie à terme.
- **Aucune couche d'accès aux données** : les requêtes Supabase sont éparpillées et dupliquées dans les composants (sélections de colonnes répétées, filtres copiés-collés).
- **Logique d'écriture métier dans l'UI** : changement de statut, création d'historique et de notifications sont faits inline dans `[id]/page.tsx` et `FicheStepper.tsx`, sans transaction ni garantie d'atomicité.
- `supabase/migrations/` **vide** → pas de schéma reproductible.

---

## 4. Analyse UX / UI

### 4.1 Identité visuelle
- Charte cohérente : bleu nuit `#1E3A5F` (primaire/sidebar), orange `#F97316` (action), fond crème `#FAF9F6`, vert pour la validation.
- Sidebar sombre fixe (desktop) + drawer mobile, topbar « glassmorphism », cartes arrondies (`rounded-xl`), ombres douces. Rendu moderne et professionnel.
- Page de login soignée (split-screen, statistiques décoratives, toggle mot de passe).

### 4.2 Parcours & ergonomie
- **Dashboard adaptatif au rôle** : le prospecteur voit ses brouillons + l'historique de ses fiches ; admin/commercial voient les compteurs globaux et les fiches récentes.
- **Wizard guidé** avec barre de progression, navigation libre entre étapes, sauvegarde fréquente : bon pour la saisie terrain.
- **Recherche + filtres par statut** sur la liste, badges de statut colorés homogènes.
- **Feedback** systématique via toasts (`sonner`).
- **Responsive** pensé (drawer mobile, grilles adaptatives, colonnes masquées en `sm`).

### 4.3 Problèmes UX/UI identifiés
1. **Badge de notifications non temps réel** : la `Topbar` ne lit le compteur qu'au montage, pas d'abonnement realtime → l'utilisateur ne voit pas les nouvelles notifications sans recharger.
2. **Notifications non cliquables = pas marquées lues** individuellement ; seul « tout marquer comme lu » existe. Le compteur Topbar ne se met pas à jour après lecture.
3. **Fiche en lecture seule** : depuis le détail, impossible de **modifier** une fiche ou de **reprendre l'édition d'un brouillon** dans le wizard. `canEditFiche` existe mais n'est branché sur aucune UI d'édition.
4. **`date_visite` / `heure_visite`** sont saisis mais **jamais affichés** dans le détail.
5. **Validation tardive et permissive** : 6 étapes sur 7 sont en pratique facultatives ; un utilisateur peut soumettre une fiche quasi vide (seuls nom/adresse/tél/CP + RGPD bloquent). Pas de retour visuel d'erreur par champ dans le wizard.
6. **Pas d'état vide riche** ni d'onboarding ; pas de confirmation avant actions sensibles (désactivation utilisateur, changement de statut).
7. **Accessibilité** : `<div onClick>` cliquables sans rôle/clavier, canvas de signature non accessible, contrastes du texte `white/40` faibles, pas de `aria-label` sur les boutons icônes.
8. **Pas de mode sombre** alors que `next-themes` et les variables `.dark` sont présents.
9. **Pas de pagination** : listes plafonnées à 50 / 20 / 5 lignes, sans « charger plus ».
10. **Photos d'un brouillon perdues** au rechargement (cf. §2.5) — risque de frustration terrain.

---

## 5. Plan d'implémentation reconstitué

> ⚠️ **Aucun document de plan initial n'existe dans le dépôt** (`README.md` est le template par défaut de `create-next-app`). Le plan ci-dessous est **reconstitué par rétro-ingénierie** du modèle de données, des rôles, du workflow et des écrans existants. Il représente l'intention manifeste du produit.

### Lot 0 — Fondations ✅ *fait*
- [x] Projet Next.js 16 + TypeScript + Tailwind v4 + shadcn
- [x] Intégration Supabase (auth, db, storage, realtime)
- [x] Middleware d'authentification et garde de routes
- [x] Multi-tenant via `organization_id`
- [x] Script de seed (org + 7 utilisateurs + 10 fiches de démo)

### Lot 1 — Authentification & utilisateurs ✅ *complet*
- [x] Page de connexion (email/mot de passe)
- [x] Gestion des rôles (ADMIN / COMMERCIAL / PROSPECTEUR)
- [x] CRUD utilisateurs côté ADMIN (création via API service_role, activation/désactivation)
- [x] Réinitialisation / mot de passe oublié (`/forgot-password`, `/reset-password`)
- [x] Édition de son propre profil + changement de mot de passe (`/profil`)

### Lot 2 — Fiche de pré-visite (saisie) ✅ *complet*
- [x] Wizard 7 étapes (coordonnées → signature)
- [x] Auto-save toutes les 30s + sauvegarde manuelle
- [x] Upload photos + signature manuscrite
- [x] Consentement RGPD obligatoire
- [x] Validation champs obligatoires étape 1 (nom, prénom, adresse, CP, ville, tél)
- [x] Fix bug sauvegarde brouillon (race condition `savedFicheId` → `ficheIdRef`)
- [x] Reprise d'édition d'un brouillon dans le wizard (`/fiches/[id]/modifier`)
- [x] Photos persistées dès le brouillon (upload immédiat si ficheId disponible)
- [x] Suppression d'un brouillon (avec confirmation + nettoyage storage)

### Lot 3 — Workflow & suivi ✅ *complet*
- [x] Statuts + transitions par rôle
- [x] Affectation à un commercial
- [x] Historique (timeline) par fiche
- [x] Détail de fiche (nom du prospecteur, photos, historique)
- [x] Édition d'une fiche soumise par admin/commercial (`mode: "edit-submitted"`)
- [x] Commentaire/motif au changement de statut (dialog + stockage en `fiche_history.comment`)

### Lot 4 — Tableau de bord & notifications ✅ *complet*
- [x] Compteurs par statut adaptés au rôle (brouillons masqués pour admin/commercial)
- [x] Fiches récentes / brouillons en cours (selon rôle)
- [x] Historique prospecteur (fiches soumises et traitées)
- [x] Temps réel : dashboard + liste `/fiches` + détail fiche (subscription `postgres_changes`)
- [x] Badge notifications temps réel dans la topbar (subscription filtrée par `user_id`)
- [x] Lecture individuelle de notification au clic + navigation vers la fiche
- [x] Notifications : affectation (commercial) + acceptation/refus (prospecteur)
- [x] Export PDF (`/fiches/[id]/imprimer`, page dédiée sans sidebar, CSS print)
- [x] Reporting direction (`/reporting`) : KPIs, répartition statuts, **évolution paramétrable par période (hebdo/mensuel/trim/semestriel/annuel) + KPIs de la période courante vs précédente** (bucketing client `lib/stats.ts`, 1 requête — N+1 supprimé), top prospecteurs

### Lot 5 — Industrialisation 🟡 *en cours*
- [x] Migrations SQL versionnées + politiques RLS dans le repo (`supabase/migrations/0001`, `0002`)
- [x] Clé `service_role` sortie de `seed.mjs` (lue depuis `.env.local`) — clé exposée **rotée et ancienne clé révoquée** côté Supabase (juin 2026)
- [x] Tests unitaires (Vitest : `permissions.ts`, `validations/fiche.ts`)
- [x] CI GitHub Actions (`typecheck` + `test` bloquants, `lint` non bloquant)
- [x] README projet + documentation d'installation
- [x] Types Supabase typés de bout en bout (`src/types/database.types.ts` + clients typés)
- [x] Validation serveur des transitions + atomicité (RPC `transition_fiche`, migration `0003`)
- [x] Tests e2e (Playwright) — auth + navigation + liste/détail (`e2e/`)
- [x] Lint bloquant (0 erreur) — conseils React Compiler conservés en `warn`
- [ ] (optionnel) Résorber les `warn` React Compiler + `<img>` → `next/image`

---

## 6. Ce qui reste — listing priorisé (état juin 2026)

### 🔴 Critique (sécurité / intégrité)
1. ✅ ~~Secret en clair dans le dépôt~~ — `scripts/seed.mjs` lit URL et clé `service_role` depuis `.env.local`. Clé exposée **rotée** (nouvelle *secret key* `sb_secret_…`) et **ancienne clé révoquée** dans le dashboard Supabase.
2. ✅ ~~Schéma & RLS non versionnés~~ — schéma complet + politiques RLS (isolation par organisation + rôle) versionnés dans `supabase/migrations/0001_initial_schema.sql` et `0002_rls_policies.sql`.
3. ✅ ~~Aucune validation métier côté serveur~~ — les transitions passent par la RPC `transition_fiche` (`supabase/migrations/0003_rpc_transitions.sql`) qui revalide la matrice par rôle + l'organisation côté serveur. **Migrations 0001→0003 appliquées** (schéma + RLS active sur les 6 tables + RPC).
4. ✅ ~~Cohérence transactionnelle~~ — `transition_fiche` écrit fiche + historique + notification dans **une seule transaction** (SECURITY DEFINER).

### 🟠 Important (fonctionnel) — ce qui reste
5. ✅ ~~**Confirmation avant de quitter le wizard**~~ — garde `beforeunload` ajouté dans `FicheStepper` (formulaire modifié / photos ou signature non envoyées).
6. ✅ ~~**Pagination** des listes~~ — `range()` Supabase + « Charger plus » sur `/fiches` et `/notifications` (page de 20).
7. ✅ ~~**Fiche archivée en lecture seule**~~ — `canEditFiche` prend désormais le statut en compte (retourne `false` si `ARCHIVEE`), branché sur les 3 chemins d'édition (reprise brouillon, modification admin/commercial, accès direct `/modifier`) ; transitions déjà bloquées. Couvert par test unitaire.
8. ✅ ~~Types DB générés~~ — `src/types/database.types.ts` (type `Database` complet), clients Supabase typés, interfaces dupliquées remplacées par des types dérivés (`Fiche`, `Profile`, `Notification`…).
9. **Tests** (aucun actuellement) + **CI**.

### 🟡 Souhaitable (qualité / produit)
10. ✅ ~~Affichage `date_visite`/`heure_visite` dans le détail~~ — champ « Visite souhaitée » (date formatée FR + heure) ajouté dans la carte Coordonnées (la page PDF l'affichait déjà).
11. ✅ ~~Mode sombre~~ — `ThemeProvider` (next-themes), bloc `.dark` complet dans `globals.css`, toggle dans la `Topbar`, et ~23 fichiers migrés des couleurs codées en dur vers les tokens sémantiques (`bg-card`, `text-foreground`, `bg-muted`…). Page d'impression et `SignatureCanvas` volontairement laissés clairs.
12. ✅ ~~Accessibilité (a11y)~~ — cartes notification rendues opérables au clavier (`role="button"` + `tabIndex` + `onKeyDown` + focus ring) ; `aria-label` sur tous les boutons icônes (toggles mot de passe, suppression, marquer-lu, hamburger/croix sidebar, suppression photo) ; `SignatureCanvas` en `role="img"` labellisé ; `aria-pressed` sur les filtres, `aria-current` sur le stepper ; overlay sidebar `aria-hidden` ; contraste du bouton Déconnexion relevé.
13. **README** réel + doc d'onboarding.
14. ✅ ~~Couche data/services~~ — `src/lib/data/{fiches,profiles,notifications}.ts` centralise les requêtes Supabase (getFicheById, getFichePhotos, getFicheHistory, countFichesByStatus, deleteFicheCascade, getActiveCommercialsAndAdmins, get/markNotifications, getAllProfiles…). Câblée dans dashboard, détail, modifier, impression, notifications, utilisateurs et la Topbar. **Corrige au passage un bug** : la suppression d'un brouillon depuis le dashboard ne nettoyait pas photos ni notifications.
15. ✅ ~~Export Excel / CSV de la liste des fiches~~ — bouton « Exporter CSV » sur `/fiches` : exporte **toutes** les fiches du filtre/recherche courant (hors pagination) via `getFichesForExport`, fichier `;`-séparé compatible Excel FR (BOM UTF-8) avec libellés de statut et nom du commercial. Utilitaires dans `src/lib/csv.ts`.
16. ✅ ~~Détection de doublons~~ — à l'étape Coordonnées du wizard, une recherche débouncée (`findDuplicateFiches`) alerte si une fiche existe déjà pour le même prospect (même téléphone, ou même nom + même code postal), avec liens cliquables vers les fiches concernées (exclut la fiche courante en édition).

---

## 7. Recommandations d'amélioration (par priorité)

### Étape 1 — Sécuriser (à faire avant tout déploiement)
1. **Roter la clé `service_role`** exposée et la sortir de `seed.mjs` (lire depuis `process.env`).
2. **Exporter le schéma et les RLS** depuis Supabase vers `supabase/migrations/` (`supabase db pull`) et les committer. Vérifier qu'une politique RLS existe sur **chaque** table et qu'elle filtre par `organization_id` + rôle.
3. Déplacer les **écritures sensibles** (transition de statut, affectation) dans des **fonctions RPC Postgres** ou des **Route Handlers** serveur qui revalident `canTransition` côté serveur, au lieu d'updates client directs.
4. S'assurer que `.env.local` n'est pas suivi par git (vérifier `.gitignore`).

### Étape 2 — Fiabiliser
5. Générer les **types Supabase** et remplacer les interfaces manuelles → typage de bout en bout.
6. Introduire une **couche `lib/data/`** (fonctions `getFiches`, `updateFicheStatus`, …) réutilisée par toutes les pages.
7. Rendre **atomiques** les opérations multi-tables (RPC transactionnelle `submit_fiche`, `assign_fiche`).
8. Mettre en place **Vitest** (unitaire, ex. `permissions.ts`) + **Playwright** (e2e du wizard et du workflow) + **lint/typecheck en CI**.

### Étape 3 — Compléter le produit
9. **Édition de fiche & reprise de brouillon** : faire pointer `/fiches/[id]` vers le wizard pré-rempli quand l'utilisateur a le droit d'éditer (`canEditFiche`).
10. **Persister les photos dès le brouillon** (upload immédiat + suppression si retrait).
11. **Notifications temps réel** : abonnement realtime dans `Topbar`, marquage lu au clic, navigation directe.
12. **Mot de passe oublié** + **page profil**.
13. **Pagination** (curseur `range()` Supabase + « charger plus » / infinite scroll).

### Étape 4 — Valoriser
14. **Reporting direction** : taux acceptation/refus, délai moyen par étape, volume par prospecteur/commercial (cartes + graphiques).
15. **Export PDF** de la fiche.
16. **Mode sombre**, **a11y**, **README** projet.
17. Renforcer la **validation par étape** (resolver Zod par étape, erreurs par champ, blocage du « Suivant » si invalide) — selon le niveau d'exigence métier souhaité.

---

## 8. Synthèse

| Dimension | Note | Commentaire |
|---|---|---|
| **Fonctionnel (cœur)** | 🟢 Solide | Workflow, wizard, RBAC, notifications, historique : le MVP est là et cohérent. |
| **UI / Design** | 🟢 Très bon | Charte pro, responsive, composants modernes. |
| **UX** | 🟡 Correct | Quelques manques : édition de fiche, temps réel partiel, validation permissive. |
| **Architecture** | 🟡 Moyen | Trop de logique et de requêtes dans l'UI, types dupliqués, pas de couche data. |
| **Sécurité** | 🟢 Solide | Clé rotée + ancienne révoquée, RLS versionnée **et appliquée** (isolation org/rôle), transitions validées et atomiques côté serveur (RPC). |
| **Industrialisation** | 🔴 Absente | Pas de migrations, pas de tests, pas de CI, doc par défaut. |

**Conclusion** : un **MVP fonctionnel et visuellement abouti**, mais qui n'est **pas prêt pour la production** tant que les points 🔴 (clé service_role exposée, schéma/RLS non versionnés, validation serveur) ne sont pas traités. Les chantiers à enclencher en priorité sont, dans l'ordre : **sécurité → versionnement du schéma → édition de fiche → tests/CI**.
