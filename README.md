# Proximité Habitat Conseil

Application web interne (SaaS multi-tenant) de gestion des **fiches de pré-visite**
pour la rénovation énergétique. Les **prospecteurs** saisissent sur le terrain les
fiches (coordonnées, logement, chauffage, ventilation, isolation, photos, signature),
la **direction** les valide et les **affecte à des commerciaux** qui les acceptent
ou les refusent.

Le cœur du produit est un **workflow de statuts** autour de l'entité *fiche* :

```
BROUILLON → SOUMISE → AFFECTEE → ACCEPTEE → ARCHIVEE
                                → REFUSEE  → ARCHIVEE
```

---

## Fonctionnalités

- **Wizard de saisie** (7 étapes) : coordonnées, habitation, chauffage, ventilation, isolation, photos, signature
- **Workflow de validation** par rôle (ADMIN / COMMERCIAL / PROSPECTEUR) avec historique commenté
- **Notifications temps réel** à chaque changement de statut (Supabase Realtime)
- **Reporting** direction avec stats par période (hebdomadaire, mensuel, trimestriel, semestriel, annuel)
- **Export CSV** de la liste des fiches (filtre en cours, compatible Excel FR)
- **Détection de doublons** à la saisie (même nom+CP ou même téléphone)
- **Mode sombre** (toggle topbar, mémorisation du choix)
- **Impression / PDF** d'une fiche (page dédiée sans sidebar)

---

## Stack

| Couche | Technologie |
|---|---|
| Framework | Next.js 16 (App Router, RSC) |
| UI | React 19, Tailwind CSS v4, shadcn / `@base-ui/react` |
| Langage | TypeScript 5 |
| Backend / DB / Auth / Storage / Realtime | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) |
| Formulaires & validation | `react-hook-form` + Zod |
| Tests | Vitest (unitaires) + Playwright (e2e) |
| Thème | `next-themes` |

---

## Prérequis

- Node.js **20+**
- Un projet [Supabase](https://supabase.com) (URL + clés API)

---

## Installation

```bash
npm install
cp .env.local.example .env.local   # puis renseigner les variables
```

### Variables d'environnement (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role` — **secret**, jamais exposée côté client |

> ⚠️ La clé `service_role` n'est utilisée que côté serveur (route `/api/users`) et
> par le script de seed. Elle ne doit **jamais** être committée. `.env.local` est
> ignoré par git (cf. `.gitignore`).

---

## Base de données

Le schéma et les politiques de sécurité (RLS) sont versionnés dans
[`supabase/migrations/`](supabase/migrations/) :

- `0001_initial_schema.sql` — tables, enums, index, triggers, buckets Storage.
- `0002_rls_policies.sql` — Row Level Security : isolation par organisation +
  contrôle d'accès par rôle, et politiques Storage.
- `0003_rpc_transitions.sql` — fonction `transition_fiche` : validation serveur
  des transitions de statut + écriture atomique (fiche + historique + notification).

Pour appliquer les migrations sur un projet Supabase, avec la
[CLI Supabase](https://supabase.com/docs/guides/cli) :

```bash
supabase link --project-ref <ref>
supabase db push
```

(ou exécuter les deux fichiers SQL dans l'éditeur SQL du dashboard, dans l'ordre).

### Seed des données de démonstration

Crée l'organisation, 7 utilisateurs et 10 fiches d'exemple. Les secrets sont lus
depuis `.env.local` (jamais codés en dur) :

```bash
npm run seed
```

Comptes de test générés :

| Rôle | Email | Mot de passe |
|---|---|---|
| Direction (ADMIN) | `admin@phc.fr` | `Admin123!` |
| Commercial | `commercial1@phc.fr` | `Commercial123!` |
| Prospecteur | `prospecteur1@phc.fr` | `Prospecteur123!` |

---

## Scripts npm

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (http://localhost:3000) |
| `npm run build` | Build de production |
| `npm start` | Serveur de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:watch` | Tests unitaires en mode watch |
| `npm run test:e2e` | Tests end-to-end (Playwright) |
| `npm run seed` | Peuplement de la base de démonstration |

---

## Architecture

```
src/
├── middleware.ts              # Garde d'authentification globale
├── types/database.ts          # Types partagés (UserRole, FicheStatus, Row types)
├── lib/
│   ├── permissions.ts         # RBAC : transitions de statut, droits, labels
│   ├── validations/fiche.ts   # Schémas Zod + constantes métier
│   ├── stats.ts               # Agrégation de statistiques par période (bucketing client)
│   ├── csv.ts                 # Utilitaires de génération et téléchargement CSV
│   ├── data/                  # Couche d'accès aux données (une requête = une fonction)
│   │   ├── fiches.ts          #   getFicheById, deleteFicheCascade, findDuplicateFiches…
│   │   ├── profiles.ts        #   getProfileById, getAllProfiles, setProfileActive…
│   │   └── notifications.ts   #   getNotifications, markNotificationRead…
│   ├── hooks/use-profile.ts   # Profil de l'utilisateur courant
│   └── supabase/              # Clients Supabase (client / server / middleware)
├── app/
│   ├── (auth)/                # login, mot de passe oublié / réinitialisation
│   ├── (dashboard)/           # dashboard, fiches, utilisateurs, notifications, reporting, profil
│   ├── (print)/               # version imprimable d'une fiche (PDF — thème forcé clair)
│   └── api/users/route.ts     # Création d'utilisateur (service_role, ADMIN only)
└── components/
    ├── ui/                    # Primitives shadcn
    ├── forms/                 # Wizard 7 étapes + signature canvas
    ├── fiches/                # Badge de statut
    ├── theme-provider.tsx     # ThemeProvider next-themes
    └── layout/                # Sidebar, Topbar, ThemeToggle
```

### Sécurité

- **Authentification** : Supabase Auth, garde de routes via `src/middleware.ts`.
- **Autorisation** : la matrice de droits (`src/lib/permissions.ts`) pilote l'UI ;
  la barrière réelle est l'ensemble des **politiques RLS** (`supabase/migrations/0002_rls_policies.sql`),
  qui isolent chaque organisation et filtrent par rôle.
- **Multi-tenant** : toutes les tables portent `organization_id` ; RLS l'impose.

---

## Tests

Tests unitaires avec Vitest (logique métier et validations) :

```bash
npm test
```

Couverture actuelle :
- Matrice de permissions (`permissions.ts`)
- Schémas de validation (`validations/fiche.ts`)
- Agrégation de statistiques par période (`stats.ts`) — avec horloge figée (`vi.useFakeTimers`) pour des résultats déterministes

### Tests end-to-end (Playwright)

Pilotent l'application réelle (auth, navigation, liste, détail de fiche) dans un
navigateur. Nécessitent un `.env.local` valide et les comptes de démo
(`npm run seed`). Le serveur de dev est démarré automatiquement (ou réutilisé
s'il tourne déjà) :

```bash
npx playwright install   # une fois, pour installer les navigateurs
npm run test:e2e
```

Comptes/URL surchargés par `E2E_EMAIL`, `E2E_PASSWORD`, `PLAYWRIGHT_BASE_URL`.

---

## CI

Le workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) exécute, à
chaque push et pull request : `typecheck`, `test` et `lint` — **tous bloquants**.
Les conseils React Compiler (`set-state-in-effect`, etc.) sont conservés en
`warn` dans `eslint.config.mjs` : visibles mais non bloquants.

---

## Dette technique connue

- Avertissements ESLint React Compiler (`setState` dans des effets) — comportements corrects mais pattern à affiner.
- `<img>` HTML dans les galeries photos (wizard + détail) : à remplacer par `next/image` pour l'optimisation.
- `aria-valuetext` du composant `Progress` (base-ui) formate le pourcentage différemment entre SSR et client — bug upstream, sans incidence fonctionnelle.
