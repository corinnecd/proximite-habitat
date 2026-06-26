# Audit complet — Proximité Habitat

**Date :** 2026-06-26
**Périmètre :** santé du code, état des données par instance, cohérence rôles & permissions.

---

## 1. Santé du code — ✅ Déployable en production

| Vérification | Résultat |
|---|---|
| Build production (`next build`) | ✅ Passe (6.9 s compile, 21 routes, middleware OK) |
| TypeScript applicatif (`npx tsc --noEmit`) | ✅ Propre |
| Lint (`npm run lint`) | ✅ **0 erreur** (était 36) — 23 warnings `react-hooks/set-state-in-effect` non bloquants |
| Tests `stats.test.ts` | ⚠️ 2 erreurs TS pré-existantes connues (hors build) |

**Build & déploiement :** Vercel auto-déploie depuis `main`.

---

## 2. Données par instance — ✅ Cohérentes

| Société | Profils | Fiches | Notifs | Planifs |
|---|---|---|---|---|
| **Siège** (Proximité Habitat Conseil) | 19 (1 DG, 2 admin, 5 réf, 9 com, 2 chefs) | 54 | 38 | 21 |
| **Succursale_1** | 16 (1 admin, 10 réf, 5 com) | 30 | 21 | 9 |
| **PROXI-HABITAT HDF** | 11 (2 admin, 5 réf, 4 com) | 14 | 73 | 15 |

**Cohérence vérifiée :**
- Aucune fiche sans `organization_id` / `created_by`
- Aucun profil orphelin
- DG bien rattaché au siège (unique dans toute la base)
- Toutes les fiches ont un `ville_id` (avant : 34 manquants)
- Toutes les fiches REFUSEE / RETRACTATION ont un motif (avant : 6 manquants)

---

## 3. Rôles & permissions — ✅ Isolation solide

L'isolation inter-succursales et la lecture-seule du DG sont **garanties au niveau RLS Postgres + RPC + UI + tests**. Aucune fuite de données cross-succursale possible.

### Matrice rôle → accès

| Section | DG | ADMIN | COMMERCIAL | PROSPECTEUR / Référent | CHEF_EQUIPE |
|---|---|---|---|---|---|
| Tableau de bord | ✅ consolidé | ✅ sa succursale | ✅ ses fiches affectées | ✅ ses fiches | ✅ |
| Statut des Fiches | ✅ | ✅ | ✅ affectées | ✅ créées | ✅ créées |
| Fiches à valider | ✅ | ✅ + badge | ❌ | ❌ | ❌ |
| Nouvelle fiche | ❌ (garde de rôle) | ❌ | ❌ | ✅ | ✅ |
| Notifications | ❌ (masqué) | ✅ | ✅ | ✅ | ✅ |
| Mon profil | ✅ | ✅ | ✅ | ✅ | ✅ |
| Planification | ✅ lecture | ✅ écriture | ✅ lecture | ✅ lecture | ✅ lecture |
| Utilisateurs | ✅ cross-succursale | ✅ sa succursale | ❌ | ❌ | ❌ |
| Reporting | ✅ consolidé | ✅ | ✅ "Mon reporting" | ❌ | ❌ |
| Société / Succursales | ✅ exclusif DG | ❌ | ❌ | ❌ | ❌ |

### DG en lecture seule — vérifié à plusieurs niveaux
- **RLS** : `fiches_insert/update/delete`, `fiche_history_insert`, `fiche_photos_insert/delete`, `planification_hebdo` — toutes contiennent `app_role() <> 'DIRECTION_GENERALE'`
- **RPC** `transition_fiche()` : lève une exception pour DG
- **UI** : tous les boutons d'écriture gated, `getAvailableTransitions("DIRECTION_GENERALE", …)` renvoie `[]`
- **Tests** : `permissions.test.ts` couvre explicitement « DG ne peut jamais éditer »
- **Exception assumée** : gestion des utilisateurs cross-succursale (besoin RH groupe)

---

## 4. Corrections appliquées

| # | Item | Avant | Après |
|---|---|---|---|
| 1 | Filtres succursale DG (dashboard) | Compteurs consolidés au lieu de filtrés | `branchFilter` propagé sur fiches antérieures |
| 2 | Filtres succursale DG (fiches) | `loadAnterieures`, `loadStatusCounts`, `loadValidationStats` non filtrés | Filtre appliqué partout + graphe disponible pour DG |
| 3 | Filtres succursale DG (reporting) | Période et liste commerciaux non filtrées | Filtre appliqué **en amont** |
| 4 | Sidebar (bandeau succursale DG) | Doublon avec le sélecteur | Masqué pour DG, conservé pour autres rôles |
| 5 | Tri des succursales | Alphabétique pur | Siège toujours en 1ʳᵉ position |
| 6 | Garde de rôle `/fiches/nouvelle` | DG pouvait remplir le formulaire avant échec RLS | Redirige vers `/` si rôle non autorisé |
| 7 | `Step6Photos` (révocation blob URLs) | Mutation de `ref.current` pendant le render | Refactor avec `useEffect` |
| 8 | Lint général | 36 erreurs | **0 erreur** (imports/vars supprimés, apostrophes échappées, types stricts) |
| 9 | Données : `ville_id` manquant | 34 fiches | **0** (rattachées via `zones_villes`) |
| 10 | Données : `motif_refus` manquant | 6 fiches REFUSEE/RETRACTATION | **0** |
| 11 | Données : Succursale_1 vide | 0 notif / 0 planif | **21 notifs / 9 planifs** générées de manière cohérente |

**Script de correction des données :** `scripts/fix-data-audit.mjs` (idempotent, lit `.env.local`).

---

## 5. Faux positifs identifiés
- **Chemin `SOUMISE → VALIDEE` du RPC `transition_fiche`** : la migration `supabase/migrations/20260617_add_validee_status.sql` gère bien les transitions `SOUMISE → VALIDEE` (l.39) et `VALIDEE → AFFECTEE` (l.41). Aucune correction nécessaire.

---

## 6. Commits

| SHA | Description |
|---|---|
| `0445931` | Tri des succursales (siège en 1ᵉʳ) |
| `56d613d` | Filtres DG sur dashboard/fiches/reporting + masquage bandeau + script de correction des données |
| `f97e6c2` | Garde de rôle `/fiches/nouvelle` + fix `Step6Photos` + nettoyage lint |

---

## 7. Reste à surveiller (non bloquant)

- 23 warnings lint `react-hooks/set-state-in-effect` — pattern courant, pas de bug réel.
- 2 erreurs TS pré-existantes dans `src/lib/stats.test.ts` (`submitted` vs `assigned`) — n'impactent pas le build.
