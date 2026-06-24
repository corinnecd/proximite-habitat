# Mémo — Direction Générale & Multi-société

> Mémo synthétique sur le rôle **Direction Générale (DG)**, les **succursales** et la
> structure multi-société. À tenir à jour au fil du développement.
> Dernière mise à jour : 2026-06-24.

---

## 1. Le principe en une phrase

Une **société mère** (`companies`) regroupe une ou plusieurs **succursales**
(chaque succursale = une `organizations` existante, totalement cloisonnée). Le rôle
**DIRECTION_GENERALE** voit **toutes les succursales de sa société en lecture seule** ;
les sociétés distinctes restent des **instances totalement indépendantes**.

```
companies (société mère)
  └── organizations (succursales)   ← is_hq = true pour le siège
        └── profiles (utilisateurs : ADMIN, COMMERCIAL, PROSPECTEUR, CHEF_EQUIPE)
              └── fiches, planification, etc.
```

---

## 2. Ce que le DG PEUT et NE PEUT PAS faire

| Action | DG |
|---|---|
| Voir les fiches / stats / reporting de **toutes** les succursales | ✅ Oui |
| Filtrer par succursale (sélecteur dans la sidebar) | ✅ Oui |
| Voir Société, Succursales, Utilisateurs, Planification (toutes succursales) | ✅ Oui |
| Créer des succursales | ✅ Oui |
| Créer / modifier des utilisateurs **dans n'importe quelle succursale** | ✅ Oui |
| **Créer / modifier / valider / affecter / supprimer des fiches** | ❌ **Non (lecture seule)** |
| Créer une planification, des photos, de l'historique | ❌ Non |

> ⚠️ **Le DG est volontairement en lecture seule sur les données métier.** Il supervise et
> consolide, il ne traite pas les fiches. Garder **au moins un ADMIN actif par succursale**
> pour le travail opérationnel (validation, affectation…).

La règle est appliquée **côté serveur** (RLS + fonction `transition_fiche`), pas seulement
dans l'interface : un DG ne peut pas contourner via un appel direct à la base.

---

## 3. Mise en route d'un DG (bootstrap, à faire UNE fois)

Pré-requis : la **société** doit exister et les organisations doivent y être rattachées,
sinon le DG se connecte mais **ne voit rien**.

### a. Créer la société + rattacher les organisations existantes (SQL Supabase)
```sql
WITH new_company AS (
  INSERT INTO public.companies (name, slug)
  VALUES ('Proximité Habitat', 'proximite-habitat')
  RETURNING id
)
UPDATE public.organizations
SET company_id = (SELECT id FROM new_company),
    is_hq = true
WHERE company_id IS NULL;
```

### b. Créer / promouvoir le compte DG
- **Option simple** : un ADMIN crée le compte depuis la page **Utilisateurs** (rôle
  « Direction Générale » désormais disponible dans la liste), OU
- **Promotion SQL** d'un compte existant :
```sql
UPDATE public.profiles SET role = 'DIRECTION_GENERALE'
WHERE email = 'email@exemple.com';
```

> Une fois le premier DG en place, il peut créer tous les autres comptes (y compris
> d'autres directions) directement depuis l'application — plus besoin de SQL.

---

## 4. Créer / configurer une succursale (depuis l'app, en tant que DG)

1. **Succursales** → **Nouvelle succursale** → saisir un nom → Créer.
2. **Rafraîchir la page (F5)** pour que la nouvelle succursale apparaisse dans le
   sélecteur de la sidebar et dans le formulaire utilisateur.
3. **Utilisateurs** → ajouter un utilisateur → champ **Succursale** (visible pour le DG)
   → choisir la succursale → rôle **Direction (ADMIN)** pour son responsable.

---

## 5. Points techniques à retenir

- **Aucune table de données métier n'a changé.** `organization_id` garde son nom et son sens.
  Tous les rôles existants fonctionnent à l'identique.
- **`company_id` est nullable** : un déploiement mono-société sans DG continue de marcher.
- **Le sélecteur de succursale** (`selectedBranchId : id | "all"`) ne fait que filtrer
  l'affichage. La sécurité réelle = RLS (`app_company_id()`, `app_company_org_ids()`).
- **La liste des succursales est chargée au montage** → penser au F5 après création.
- **APIs dédiées** :
  - `POST /api/branches` — créer une succursale (DG authentifié).
  - `POST /api/companies` — bootstrap société + siège + DG (protégé par l'en-tête
    `x-platform-secret` = variable d'env `PLATFORM_ADMIN_SECRET`). Usage plateforme, rare.
- **Variables d'environnement (Vercel)** : `SUPABASE_SERVICE_ROLE_KEY` (création users/branches),
  et `PLATFORM_ADMIN_SECRET` seulement si on utilise `/api/companies`.

---

## 6. Fichiers clés (pour s'y retrouver)

| Rôle | Fichier |
|---|---|
| Migration SQL multi-société | `supabase/migrations/20260623_companies_branches.sql` |
| Types (`Company`, `UserRole`…) | `src/types/database.types.ts` |
| Permissions DG | `src/lib/permissions.ts` |
| Contexte succursale + sélecteur | `src/lib/context/branch-context.tsx`, `src/components/layout/BranchSelector.tsx` |
| Pages DG | `src/app/(dashboard)/admin/societe/`, `src/app/(dashboard)/admin/succursales/` |
| APIs | `src/app/api/branches/route.ts`, `src/app/api/companies/route.ts`, `src/app/api/users/route.ts` |

---

## 7. Données de test — Succursale_1

Peuplée via `scripts/seed-succursale.mjs` (script **non destructif**, ciblé par slug) :
```bash
node --env-file=.env.local scripts/seed-succursale.mjs succursale-1
```
Contenu : **16 utilisateurs** (1 ADMIN, 5 commerciaux, 10 référents) + **30 fiches**
réparties sur les 8 statuts, données fictives aléatoires cohérentes (CA ~77 k€ sur les
ACCEPTEE, motifs de refus, historique de soumission/décision pour les stats).

Comptes (mot de passe commun : `Test1234!`) :
- `directeur.s1@succ-test.fr` — ADMIN de la succursale
- `commercial1..5.s1@succ-test.fr` — commerciaux
- `referent1..10.s1@succ-test.fr` — référents

**Test de cloisonnement** : se connecter avec `directeur.s1` → ne doit voir **que** les
30 fiches de Succursale_1. Se connecter en **DG** → « Toutes les succursales » = vue
consolidée (siège + Succursale_1) ; sélectionner « Succursale_1 » = uniquement ses 30 fiches.

> ⚠️ Le garde-fou du script refuse de re-seeder une succursale déjà peuplée (anti-doublon).

## 8. À faire / idées d'évolution

- [x] ~~Filtrer la **liste des utilisateurs** par la succursale sélectionnée~~ (fait — DG :
      la page Utilisateurs et ses compteurs respectent le sélecteur de succursale).
- [x] ~~Masquer la page **Notifications** pour le DG~~ (fait — entrée retirée de la sidebar DG).
- [ ] Rafraîchir automatiquement la liste des succursales après création (éviter le F5).
- [ ] Restreindre la création d'un DG aux DG existants (sécurité, en multi-succursales réel).
- [ ] Édition / désactivation d'une succursale.

> ✍️ **À alimenter** au fil du développement : ajouter ici toute nouvelle règle, page ou
> comportement lié au DG / aux succursales.

---

## 9. Déploiement d'une nouvelle instance client (Modèle B)

Pour livrer l'application à un nouveau client = **instance totalement indépendante** (sa
propre base Supabase + son propre Vercel, from zero) : suivre **`INSTALLATION.md`**.
Bootstrap de la 1ʳᵉ société + siège + DG via `scripts/bootstrap-instance.mjs` (non destructif).

> 🔴 `INSTALLATION.md` est un **document vivant** : toute migration/variable/rôle ajouté
> au projet doit y être répercuté (voir son §9 « Journal des mises à jour »).
