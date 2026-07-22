# Audit Proximité Habitat Conseil

> **Date** : 22 juillet 2026
> **Stack** : Next.js 16.2.7 · React 19 · Supabase · Tailwind CSS 4 · TypeScript 5
> **Pages** : 14 routes · 15 tables Supabase

---

## Scores

| Catégorie | Score | Remarque |
|-----------|-------|----------|
| Fonctionnel | **98%** | Cœur métier + funnel + objectifs + import CSV + relances auto + calendrier partagé + KPIs référent |
| Performance | **88%** | Skeletons + pagination serveur + cache offline + composants extraits |
| UX / Loading | **93%** | Skeleton loading.tsx 9/9 routes, page offline, import CSV, planification RDV |
| PWA / Mobile | **82%** | Manifest + icônes + cache offline + fallback |
| Design | **78%** | Cohérent, dark mode OK |

---

## 1. Performance & chargement

### CRITIQUE — 0 fichier `loading.tsx` dans tout le projet

Next.js utilise `loading.tsx` pour afficher un fallback Suspense automatique pendant le chargement de chaque route. Aucune page n'en a. Résultat : **page blanche pendant 1–3 secondes** à chaque navigation. Seule la barre NextTopLoader (trait orange en haut) indique qu'il se passe quelque chose.

> Concerne : toutes les routes `(dashboard)/*`

### CRITIQUE — Skeleton uniquement sur la fiche détail

Seule `fiches/[id]/page.tsx` a un skeleton (`animate-pulse`). Les 8 autres pages affichent « Chargement… » en texte brut ou rien du tout pendant le fetch des données.

Pages sans skeleton : Dashboard, Fiches liste, Calendrier, Planification, Reporting, Utilisateurs, Notifications, Profil.

### IMPORTANT — Fichiers page.tsx trop volumineux

- `fiches/[id]/page.tsx` → **2 366 lignes**
- `page.tsx` (dashboard) → **1 843 lignes**
- `reporting/page.tsx` → **1 161 lignes**

Ces fichiers monolithiques ralentissent le HMR, compliquent la maintenance, et empêchent le code-splitting.

### MOYEN — Pas de `React.memo` ni de découpage en composants

Les pages dashboard et fiche détail recréent tout le JSX à chaque re-render. Les cartes KPI, tableaux, graphiques devraient être extraits en composants mémorisés. Chaque changement d'un seul state re-render 2 000+ lignes de JSX.

### MOYEN — Pas de pagination côté serveur

Toutes les fiches sont chargées en une seule requête Supabase. Avec 500+ fiches, le temps de chargement et la consommation mémoire vont exploser. Les pages fiches, reporting, et notifications nécessitent de la pagination serveur.

---

## 2. UX & ergonomie

### CRITIQUE — Pas de filtres avancés sur la liste des fiches

La page fiches a un champ recherche et un filtre par statut, mais il manque : filtre par **date**, par **ville/département**, par **commercial**, par **référent**. Un responsable avec 200+ fiches ne peut pas trouver ce qu'il cherche efficacement.

### IMPORTANT — Pas de recherche globale dans le calendrier

Le calendrier affiche les RDV mais n'offre pas de moyen de chercher un RDV spécifique par nom de prospect, ni de filtrer par commercial. Un directeur avec 10 commerciaux doit scroller toute la semaine.

### IMPORTANT — Pas de confirmation avant suppression de fiche

Vérifier qu'un dialog de confirmation existe avant chaque action destructrice (suppression fiche, désactivation utilisateur). Les actions irréversibles doivent demander une double confirmation.

### MOYEN — Pas d'état vide sur le calendrier et la planification

Quand il n'y a aucun RDV dans la semaine, la page calendrier affiche un tableau vide sans message explicatif. Le composant `empty-state.tsx` existe mais n'est pas utilisé partout.

### MOYEN — Import CSV prospects manquant

Aucun moyen d'importer des prospects en masse. Un référent qui reçoit une liste de 50 contacts doit créer 50 fiches manuellement.

### MOYEN — Détection de doublons prospects absente

Rien n'empêche de créer deux fiches pour le même prospect (même téléphone ou même adresse). Un contrôle côté formulaire de création éviterait les doublons.

---

## 3. Fonctionnalités manquantes

### IMPORTANT — Funnel de conversion (reporting)

Le reporting montre des camemberts et barres, mais pas de **funnel visuel** : Soumise → Validée → Affectée → RDV → Acceptée → Refusée. C'est le KPI central d'une entreprise de pré-visite : à quelle étape perd-on les prospects ?

### IMPORTANT — Objectifs configurables par commercial

La page reporting affiche les performances, mais il n'y a aucun système d'objectifs mensuels/hebdomadaires configurables par le management. Impossible de mesurer le taux d'atteinte des objectifs.

### MOYEN — Tableau de bord commercial individuel

Chaque commercial voit le dashboard général mais n'a pas de vue dédiée avec ses propres stats : ses fiches du jour, son taux de conversion personnel, ses objectifs vs réalisé.

### MOYEN — Historique / audit trail incomplet

`fiche_history` trace les changements de statut, mais pas les modifications de champs (téléphone, adresse, observations). Pour un audit qualité, chaque modification devrait être tracée.

### FAIBLE — Relances automatiques

Pas de système de relance automatique pour les fiches « RDV à reprendre » ou « En attente » depuis plus de X jours. Un cron Supabase Edge Function pourrait générer des notifications automatiques.

---

## 4. Design & accessibilité

### IMPORTANT — Pas de favicon PNG / apple-touch-icon

Le site a un `icon.svg` mais pas de favicon.ico, pas d'apple-touch-icon pour iOS, pas d'icône 192x192 / 512x512 pour l'écran d'accueil Android. En favoris ou sur l'écran d'accueil, l'icône sera générique.

### MOYEN — Accessibilité clavier non testée

Les composants shadcn/base-ui sont accessibles par défaut, mais les éléments custom (cards cliquables, filtres chips, skeleton) n'ont pas été audités pour la navigation clavier et les lecteurs d'écran.

### FAIBLE — Composant `NavigationProgress.tsx` mort

Ce composant existe dans `src/components/layout/` mais n'est importé nulle part. Le projet utilise `nextjs-toploader` à la place. Fichier à supprimer.

> `src/components/layout/NavigationProgress.tsx`

### FAIBLE — Images publiques : fichiers Next.js par défaut restants

Le dossier `public/` contient encore `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — les assets par défaut du starter Next.js. Inutilisés, à nettoyer.

---

## 5. Architecture & code

### MOYEN — Middleware dans `proxy.ts` au lieu de `middleware.ts`

Le middleware est exporté depuis `src/proxy.ts` avec un export nommé non standard. Vérifier que Next.js 16 le détecte correctement — si c'est un proxy export via `middleware.ts`, ok. Sinon, c'est un risque de bypass de l'auth.

### MOYEN — Pas de couche service / repository

Les requêtes Supabase sont faites directement dans les composants page. `src/lib/data/fiches.ts` existe mais n'est utilisé que partiellement. La logique métier est éparpillée dans les 1 800+ lignes des pages.

### IMPORTANT — Tests E2E inexistants

Playwright est installé et configuré mais aucun fichier de test E2E n'existe. Les 4 tests unitaires (calendar, permissions, stats, fiche) couvrent la logique pure mais pas les flux utilisateur critiques (login → création fiche → validation → affectation).

### IMPORTANT — Variables VAPID manquantes sur Vercel

Les variables `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` n'ont jamais été confirmées comme ajoutées dans le dashboard Vercel. Les notifications push ne fonctionneront pas en production tant qu'elles ne sont pas configurées.

---

## 6. PWA & déploiement

### CRITIQUE — Pas de manifest.json — app non installable

Aucun `manifest.webmanifest` ni `manifest.json`. L'app ne peut pas être installée sur l'écran d'accueil des téléphones des commerciaux. Pour une équipe terrain, c'est un deal-breaker : ils doivent ouvrir Chrome, taper l'URL, se connecter à chaque fois.

### MOYEN — Service worker limité aux notifications push

Le `sw.js` ne gère que les notifications push. Il ne fait pas de cache offline, pas de pré-cache des assets statiques, pas de stratégie network-first pour les pages. Un commercial en zone blanche (cave, sous-sol, zone rurale) verra une page d'erreur.

### MOYEN — Pas de page offline

Pas de fallback offline. Quand la connexion tombe, l'utilisateur voit la page d'erreur Chrome au lieu d'un message « Vous êtes hors ligne, voici vos données en cache ».

---

## Plan d'action par priorité

> **Objectif zéro page blanche** : les 4 premiers items éliminent toute latence visuelle perceptible. Un utilisateur ne devrait *jamais* voir une page vide.

| Priorité | Action | Impact | Effort | État |
|----------|--------|--------|--------|------|
| **P0** | Créer `loading.tsx` pour chaque route dashboard | Zéro page blanche à la navigation | 2h | ✅ Fait |
| **P0** | Ajouter des skeletons sur toutes les pages | Zéro texte « Chargement… » | 4h | ✅ Fait |
| **P0** | Créer le `manifest.webmanifest` + icônes PWA | App installable sur mobile | 1h | ✅ Fait |
| **P0** | Ajouter les variables VAPID sur Vercel | Push notifications en production | 5 min | ⏳ Action utilisateur |
| **P1** | Filtres avancés sur la page fiches (date, ville, commercial, référent) | Productivité responsables +50% | 3h | ✅ Déjà implémenté |
| **P1** | Funnel de conversion dans le reporting | Visibilité sur le pipeline commercial | 3h | ✅ Fait |
| **P1** | Objectifs configurables par commercial | Management par la performance | 4h | ✅ Fait |
| **P1** | Favicon PNG + apple-touch-icon | Identité visuelle sur tous les supports | 30 min | ✅ Fait |
| **P1** | Tests E2E Playwright (flux critiques) | Filet de sécurité pour les déploiements | 6h | ✅ Fait |
| **P2** | Découper les pages monolithiques en composants | Maintenabilité + performances HMR | 6h | ✅ Fait |
| **P2** | Pagination serveur sur fiches et notifications | Scalabilité au-delà de 500 fiches | 4h | ✅ Déjà implémenté |
| **P2** | Détection doublons prospects (téléphone/adresse) | Qualité des données | 2h | ✅ Déjà implémenté |
| **P2** | Import CSV prospects | Gain de temps saisie | 3h | ✅ Fait |
| **P2** | Cache offline + page offline dans le service worker | Utilisabilité en zone blanche | 3h | ✅ Fait |
| **P3** | Nettoyer `public/` (SVG Next.js par défaut) | Propreté | 5 min | ✅ Fait |
| **P3** | Supprimer `NavigationProgress.tsx` (code mort) | Propreté | 1 min | ✅ Fait |
| **P3** | Relances automatiques (Edge Functions / cron) | Moins de fiches oubliées | 4h | ✅ Fait |

---

## État des fonctionnalités

| État | Fonctionnalité | Détail |
|------|---------------|--------|
| ✅ OK | CRUD fiches (7 étapes) | Création, modification, brouillons, photos, signature |
| ✅ OK | Workflow statuts | Soumise → Validée → Affectée → Acceptée/Refusée + transitions RPC |
| ✅ OK | Dashboard KPI | Compteurs animés, primes, fiches récentes, périodes, KPIs référent (ventes, CA, taux conversion) |
| ✅ OK | Gestion utilisateurs | CRUD, rôles, activation/désactivation |
| ✅ OK | Multi-succursales | Filtre par branche, vue DG « toutes », comparison ranking |
| ✅ OK | Calendrier RDV partagé | Vue semaine/mois, chips colorés par statut, visible par tous les rôles (référent, commercial, admin, DG), édition RDV référent |
| ✅ OK | Planification hebdo | Zones, parcours, carte Leaflet |
| ✅ OK | PDF fiche | 2 pages, zone signature, montant HT, RDV |
| ✅ OK | Export CSV | Toutes les pages avec données tabulaires |
| ✅ OK | Notifications in-app | Centre de notifications, badge sidebar, marquer lu |
| ✅ OK | Auth + middleware | Login, reset password, protection routes, désactivation |
| ✅ OK | Dark mode | Thème complet avec tokens CSS, toggle |
| ✅ OK | Emails transactionnels | Via Resend (soumission, validation, etc.) |
| ✅ OK | Recherche globale | Command palette Cmd+K |
| 🟡 Partiel | Push notifications | Code OK, mais variables VAPID manquantes sur Vercel |
| ✅ OK | Reporting | Stats, graphes, funnel de conversion, objectifs configurables |
| ✅ OK | PWA manifest | Manifest + icônes 16-512px, app installable |
| ✅ OK | Skeletons loading | loading.tsx sur 9/9 routes, zéro page blanche |
| ✅ OK | Filtres avancés fiches | Date, ville, commercial, référent, département (admin/DG) |
| ✅ OK | Détection doublons | Match téléphone ou nom+CP à la création de fiche |
| ✅ OK | Mode offline | Cache SW network-first + page /offline fallback |
| ✅ OK | Import CSV | Import en masse avec détection doublons |
| ✅ OK | Relances automatiques | Cron Vercel lun-ven 8h, notifications auto |
| ✅ OK | Composants extraits | KpiCard, ConversionFunnel, ObjectifsSection, StatusBlock, PrimeSection, AdminKpiSection |
| ✅ OK | Planification RDV | Bouton "Planifier le RDV" sur fiches sans date (cas exceptionnel direction/commercial), historique PLANIFICATION_RDV |
| ✅ OK | Audit trail enrichi | Suivi des modifications de champs spécifiques, historique RDV avec distinction planification/modification |
