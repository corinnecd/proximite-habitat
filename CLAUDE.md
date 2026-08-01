@AGENTS.md

# Suivi des modifications (MODIFICATIONS.md)

## Règle obligatoire

**En fin de session, ou après toute série de modifications significatives (au moins une fois par jour de travail), ajouter une synthèse datée en tête de `MODIFICATIONS.md`.**

- Format : nouvelle section `## AAAA-MM-JJ — Titre court`, regroupée par thème, avec les fichiers touchés
- Objectif : permettre un retour arrière précis (savoir à partir de quelle date/commit revenir en arrière) et garder un historique complet et lisible du projet
- Insérer la nouvelle section juste après le titre principal, avant les sections précédentes (ordre antéchronologique)

## En début de nouvelle conversation sur ce projet

**Lire `MODIFICATIONS.md` en priorité** (les dernières sections en tête) pour se resynchroniser sur l'état du projet et la dernière session de travail, avant de redemander du contexte à l'utilisateur. Cela minimise la consommation de tokens et évite de faire répéter le contexte.

# Règles de chargement des pages (UX zéro-flash)

## Principe fondamental

**JAMAIS de page blanche, skeleton, spinner ou saccade au chargement.** Le layout complet s'affiche immédiatement. Les données remplissent la structure quand elles arrivent.

## Pattern obligatoire : localStorage cache + stale-while-revalidate

### 1. Restauration synchrone avant le paint

```tsx
useLayoutEffect(() => {
  if (!cacheKey) return;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return;
    const c = JSON.parse(raw);
    if (c.list?.length) { setList(c.list); setLoading(false); }
    // Restaurer TOUTES les données : compteurs, stats, sous-listes
  } catch { /* ignore */ }
}, [cacheKey]);
```

### 2. Fetch avec stale-while-revalidate

```tsx
// NE PAS faire setLoading(true) si le cache a des données
if (!cachedDataExists) setLoading(true);
// Fetch, puis remplacer silencieusement les données cachées
```

### 3. Sauvegarde du cache avec variables locales

```tsx
// TOUJOURS utiliser des variables locales fraîches, PAS les états React
const freshData = await fetchFromSupabase();
setData(freshData); // met à jour React
localStorage.setItem(cacheKey, JSON.stringify({
  list: freshData.slice(0, 20), // limiter à 20-30 items
  counts: freshCounts,          // variable locale, pas l'état
}));
```

### 4. Clés de cache par utilisateur

```tsx
const cacheKey = profile ? `page_cache_${profile.id}` : "";
// Chaque utilisateur/rôle/succursale a son propre cache
```

## Interdictions absolues

| Interdit | Faire à la place |
|----------|-----------------|
| `if (loading) return null` | Afficher le layout avec fallbacks (`?? " "`, `?? 0`) |
| `if (!profile) return null` | Afficher le layout, cacher les sections avec `{profile && (...)}` |
| `{loading ? null : content}` | `{!loading && noData ? <EmptyState/> : content}` |
| `setFiches([]); setLoading(true)` dans useEffect sync | Ne jamais détruire les données cachées |
| `setLoading(true)` si cache existe | Stale-while-revalidate : afficher le cache, fetch en arrière-plan |
| Skeleton / Spinner / "Chargement..." visible | Layout immédiat avec espaces vides qui se remplissent |
| Sauvegarder l'état React dans le cache | Utiliser des variables locales fraîches (l'état n'est pas encore à jour) |

## Pages et leur stratégie

| Page | Cache | Clé |
|------|-------|-----|
| Dashboard (`page.tsx`) | Oui — toutes les listes par rôle | `dash_cache_${profile.id}` |
| Fiches (`fiches/page.tsx`) | Oui — fiches + statusCounts | `fiches_cache_${profile.id}_${status}` |
| Reporting (`reporting/page.tsx`) | Oui — stats, referents, villes, etc. | `rpt_cache_${profile.id}` |
| Notifications (`notifications/page.tsx`) | Oui — 30 dernières notifications | `notif_cache_${profile.id}` |
| Profil (`profil/page.tsx`) | Via ProfileProvider | ProfileProvider localStorage |
| Calendrier | Non — données contextuelles par mois/semaine | — |
| Planification | Non — pas de loading propre | — |
| Admin Société | Non — page légère, layout immédiat | — |
| Admin Succursales | Non — page légère, layout immédiat | — |
| Utilisateurs | Non — hero avec pulse, liste apparaît après | — |
| Fiche détail | Non — données dynamiques par fiche | — |

## Checklist avant de modifier une page

1. La page a-t-elle un `return null` ou `loading ? null` ? → Supprimer
2. Le `useEffect` synchrone détruit-il des données cachées ? → Supprimer le reset
3. Le `fetchData` force-t-il `setLoading(true)` même si le cache existe ? → Conditionner
4. Le cache sauvegarde-t-il des états React (pas encore à jour) ? → Variables locales
5. Le cache restaure-t-il TOUTES les données de la page ? → Compléter
