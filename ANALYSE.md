# Analyse du projet — Proximité Habitat Conseil

> Dernière mise à jour : **2026-07-21** (remplace la version de juin 2026, devenue
> obsolète après plusieurs semaines de développement intensif : calendrier RDV,
> notifications push, multi-société, vue comparative, widgets de reporting, etc.)

Application web interne (SaaS multi-tenant) de gestion des **fiches de pré-visite**
pour la rénovation énergétique. Stack : Next.js 16 (App Router/RSC), React 19,
TypeScript 5, Tailwind v4, Supabase (Auth/DB/Storage/Realtime), `react-hook-form` + Zod,
Vitest + Playwright.

---

## 1. Fonctionnalités livrées (vérifiées dans le code au 2026-07-21)

### Cœur métier — Fiches
- Wizard de saisie en 7 étapes (coordonnées, habitation, chauffage, ventilation,
  isolation, photos, signature) — `src/components/forms/FicheStepper.tsx`
- Workflow de statuts complet : `BROUILLON → SOUMISE → AFFECTEE → ACCEPTEE/REFUSEE
  → ARCHIVEE`, + statuts `VALIDEE`, `RETRACTATION`, **`RDV_A_REPRENDRE`** (client
  absent lors de la visite, avec badge orange persistant et flow de reprise complet)
- Historique de fiche commenté (`fiche_history`, RLS dédiées)
- Détection de doublons à la saisie (même nom+CP ou même téléphone)
- Export CSV (filtre courant, compatible Excel FR) et **Export PDF** de la fiche
  (page dédiée sans sidebar, zone de signature incluse) — `src/components/pdf/FichePDF.tsx`
- Page fiche détail (`fiches/[id]/page.tsx`, ~2400 lignes) : édition inline,
  changement de statut, réaffectation commercial, historique, modification RDV

### Rendez-vous / Calendrier
- **Vue Calendrier des RDV** commerciaux (`/calendrier`) : vue semaine/mois,
  navigation par période, badge nom client en gras + tooltip « Plus de détails »
- **Modification de la date de RDV** depuis la fiche et depuis le calendrier
  (`RdvEditDialog.tsx`)
- Page **Planification** (zones, parcours hebdomadaires, carte des villes)

### Notifications
- Notifications temps réel (Supabase Realtime) à chaque changement de statut
- **Web Push** (VAPID) : abonnement navigateur, alertes reçues même onglet fermé
  (`/api/push/subscribe`, `/api/push/send`, `use-push-subscription.ts`)
- Centre de notifications dédié (`/notifications`)

### Reporting / Dashboard
- Dashboard par rôle (ADMIN / DIRECTION_GENERALE / COMMERCIAL / CHEF_EQUIPE / PROSPECTEUR)
- Filtres période : semaine / mois / trimestre / semestre / année / personnalisée
  (`src/lib/periods.ts`, `stats.ts`)
- **Widget « Résumé des validations par semaine »** (trimestre courant) pour DG/Admin
- Tableau chiffre d'affaires, taux de conversion, taux d'acceptation
- **Vue comparative entre succursales** (Direction Générale)

### Multi-société / Organisation
- Gestion **multi-société et succursales** (`/admin/societe`, `/admin/succursales`)
- Rôle **DIRECTION_GENERALE** avec `BranchContext` / `BranchSelector` /
  `use-branch-filter.ts` pour filtrer les données par succursale
- Gestion des utilisateurs par rôle (`/utilisateurs`), permissions centralisées
  (`src/lib/permissions.ts`)

### UX / Divers
- Recherche globale Cmd+K enrichie (navigation, utilisateurs, groupes)
- Mode sombre (persistant), cache de profil en `localStorage` (rendu instantané
  au refresh), suppression des early-returns de loading bloquants
- `NavigationProgress`, `CommandPalette`, carte des villes (`VilleMap`/`RouteMap`)

---

## 2. Base de données (Supabase)

26 fichiers de migration dans `supabase/migrations/` (de `0001_initial_schema.sql`
à `20260721_push_subscriptions.sql`), couvrant : schéma initial, RLS, RPC de
transition de statut, notifications (soumission/vente/affectation/doublons),
statut `RETRACTATION` puis `RDV_A_REPRENDRE`, champs RDV/référent, zones de
planification, multi-société/succursales, parcours hebdomadaires, table
`push_subscriptions`.

**⚠️ Toujours aucun mécanisme de rollback (`down migration`)** : en cas de besoin
de revert en prod, il faut écrire une migration corrective manuelle plutôt que
d'annuler proprement. C'est le seul point DB non traité depuis l'analyse de juin.

---

## 3. Tests & CI

- **CI GitHub Actions** (`.github/workflows/ci.yml`) : `npm ci` → typecheck →
  tests unitaires → lint bloquant (0 erreur). *Cette case, notée « Absent » dans
  l'ancienne version du document, est en réalité faite.*
- **Tests unitaires Vitest** (4 fichiers) : `permissions.test.ts`,
  `validations/fiche.test.ts`, `calendar.test.ts`, `stats.test.ts`
- **Tests E2E Playwright** : `playwright.config.ts` + `e2e/navigation.spec.ts` +
  `e2e/auth.spec.ts` — présents mais **couverture minimale** (2 specs seulement :
  navigation de base et auth). Aucun scénario e2e sur le wizard fiche, le
  workflow de validation, le calendrier ou les notifications push.
- Aucun test de composant React (dialogs, pages dashboard, `RdvEditDialog`, etc.)
- Aucun test d'intégration RPC Supabase (transitions de statut, RLS)

---

## 4. Ce qui reste réellement à faire

🔴 **Prioritaire**
1. **Rollback de migrations** — aucun script `down`, à formaliser au moins pour
   les migrations les plus sensibles (transitions de statut, RLS)
2. **Élargir la couverture e2e Playwright** — ajouter des specs sur le wizard de
   saisie, le workflow de validation/affectation, le calendrier RDV, les push
3. **Tests de composants** — au minimum sur les flux critiques (`RdvEditDialog`,
   `FicheStepper`, dashboards par rôle)

🟡 **Secondaire**
4. **Accessibilité** — travail encore ponctuel (quelques `aria-label`/`tabIndex`
   ajoutés au fil de l'eau), pas d'audit systématique (contraste, focus trap
   dans les dialogs, navigation clavier complète, lecteurs d'écran)
5. **Vérification en conditions réelles** du widget « résumé des validations »
   avec un vrai compte Direction Générale en production (Vercel)
6. **Suivi des tâches** — pas de tracker unique à jour ; ce document
   (`ANALYSE.md`) doit être réactualisé régulièrement pour éviter un nouveau
   décalage comme celui constaté entre juin et juillet 2026

✅ **Non prioritaire / nice-to-have**
- Nettoyage des scripts `_check_*.mjs` / `_inspect*.mjs` dans `scripts/`
  (scripts de debug ponctuels, à archiver ou supprimer)
- Documentation utilisateur (guide par rôle) — inexistante à ce stade

---

## 5. Points d'attention techniques

- Quelques fixes récents liés au **build Vercel** (VAPID, `web-push` en
  `serverExternalPackages`, typage `applicationServerKey`) — le déploiement est
  stable actuellement mais ce type de config mérite un test de build local
  systématique avant de merger sur `main`
- Fichiers volumineux à surveiller : `fiches/[id]/page.tsx` (~2400 lignes),
  `(dashboard)/page.tsx` (~1840 lignes), `reporting/page.tsx` (~1160 lignes) —
  candidats à un découpage en sous-composants si de nouvelles fonctionnalités
  doivent y être ajoutées
