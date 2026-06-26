# Guide d'installation — Nouvelle instance (Modèle B : instance indépendante)

> Procédure pour déployer une **instance totalement autonome** de l'application pour un
> nouveau client : sa propre base Supabase, son propre déploiement Vercel, ses propres
> données — **aucun lien** avec l'instance de démonstration.
>
> 🔴 **DOCUMENT VIVANT** — à mettre à jour à **chaque évolution importante** du schéma,
> des variables d'environnement, des rôles ou du flux d'onboarding. Voir §9.
>
> Dernière mise à jour : 2026-06-24.

---

## 0. Vue d'ensemble (qui fait quoi)

| Étape | Qui |
|---|---|
| Créer le projet Supabase, le projet Vercel, saisir les secrets | **Toi / le client** (création de comptes, saisie de mots de passe) |
| Appliquer le schéma SQL, créer les buckets, bootstrap société+DG, déployer, vérifier | **Peut être fait par l'assistant** si les clés sont dans un `.env.local` local |

---

## 1. Créer le projet Supabase (client)

1. Sur [supabase.com](https://supabase.com) → **New project**.
2. Noter le mot de passe de la base (généré).
3. Récupérer dans **Project Settings → API** :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - clé `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - clé `service_role` (secrète) → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Appliquer le schéma (SQL Editor)

> ⚠️ **Ne PAS utiliser** `supabase/migrations/001_initial_schema.sql` (ancien schéma
> hérité, en doublon). Le schéma de référence est la **série `0001…`** + les migrations datées.

Exécuter les fichiers de `supabase/migrations/` **dans cet ordre exact** (copier-coller le
contenu de chaque fichier dans le SQL Editor, un par un) :

```
1.  0001_initial_schema.sql
2.  0002_rls_policies.sql
3.  0003_rpc_transitions.sql
4.  0004_notify_admins_on_soumise.sql
5.  0005_vente_notification.sql
6.  0006_delete_notif_on_processed.sql
7.  0007_notify_prospecteur_on_affectee.sql
8.  0008_add_retractation_status.sql
9.  20260612_add_rdv_referent_fields.sql
10. 20260616_add_prospect_email.sql
11. 20260616_zones_planification.sql      ← AVANT chef_equipe (crée planification_hebdo)
12. 20260616_chef_equipe.sql
13. 20260616_seed_villes.sql
14. 20260617_add_validee_status.sql
15. 20260622_add_montant_ht.sql
16. 20260623_secure_planification_rls.sql
17. 20260623_companies_branches.sql
```

### ⚠️ Règle d'or pour les enums
PostgreSQL **interdit** d'ajouter une valeur d'enum et de l'utiliser dans la **même
transaction**. Pour **tout fichier contenant `ALTER TYPE ... ADD VALUE`** (notamment
`0008`, `20260616_chef_equipe`, `20260617`, `20260623_companies_branches`) :
1. exécute d'abord **uniquement** la/les ligne(s) `ALTER TYPE ... ADD VALUE ...` ;
2. puis exécute le **reste** du fichier dans un second Run.

> 💡 Alternative pro (si la CLI Supabase est installée) : `supabase db dump` depuis une base
> de référence pour produire un **schéma consolidé** unique. À tester contre la base vierge.

---

## 3. Buckets Storage

Les buckets **`photos`** et **`signatures`** (privés) sont nécessaires. Ils sont créés
**automatiquement** par le script de bootstrap (§5). Sinon, manuellement :
Supabase → **Storage** → New bucket → `photos` (privé), puis `signatures` (privé).

---

## 4. Variables d'environnement

Créer un fichier `.env.local` à la racine (pour exécuter les scripts en local) **et**
configurer les mêmes variables côté Vercel (§6) :

```bash
NEXT_PUBLIC_SUPABASE_URL=...           # URL du projet Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # clé anon
SUPABASE_SERVICE_ROLE_KEY=...          # clé service_role (SECRÈTE — jamais commitée)
PLATFORM_ADMIN_SECRET=...              # secret libre, requis seulement pour /api/companies
# Config email si utilisée (voir src/lib/email.ts) :
# RESEND_API_KEY=...  / EMAIL_FROM=...
```

> 🔒 `.env.local` ne doit jamais être commité (vérifier `.gitignore`).

---

## 5. Initialiser la société + le siège + le DG

Base **vierge** uniquement. Crée la société, son siège (`is_hq`), le compte DG, et les
buckets si absents :

```bash
node --env-file=.env.local scripts/bootstrap-instance.mjs \
  --company "Nom de la société" --hq "Siège" \
  --email dg@societe.fr --password "MotDePasseFort123!" \
  --first "Prénom" --last "Nom"
```

Le script **refuse de s'exécuter si une société existe déjà** (garde-fou anti-écrasement).

> ❌ **Ne jamais lancer `scripts/seed.mjs`** sur une base client : il est **destructif**
> (il efface toutes les données). Il est réservé à la base de démonstration.

---

## 6. Déployer sur Vercel

1. Le client crée un projet Vercel et y connecte le dépôt.
2. **Project Settings → Environment Variables** : saisir les 4 variables du §4
   (Production + Preview).
3. Déploiement :
   ```bash
   npx vercel --prod
   ```

---

## 7. Vérifications post-installation

- [ ] Connexion avec le compte DG → OK
- [ ] Sidebar : sélecteur de succursales + section « Direction Générale » (Société, Succursales)
- [ ] Page **Société** : nom correct, 1 succursale (le siège), 1 utilisateur (le DG)
- [ ] Le DG crée une succursale (page Succursales) → après **F5**, elle apparaît dans le sélecteur
- [ ] Le DG crée un ADMIN dans cette succursale (page Utilisateurs, champ « Succursale »)
- [ ] Cet ADMIN ne voit que les données de sa succursale (cloisonnement)
- [ ] Upload d'une photo / signature sur une fiche → OK (buckets fonctionnels)

---

## 8. Rappels d'architecture

- Une **instance = une base Supabase + un déploiement Vercel** = un client, totalement isolé.
- Dans une instance, la hiérarchie est : `companies` → `organizations` (succursales) → `profiles` → `fiches`.
- Le rôle **DIRECTION_GENERALE** = lecture seule consolidée sur toutes les succursales de SA société.
- Détails du fonctionnement DG : voir **`MEMO_DIRECTION_GENERALE.md`**.

---

## 9. Personnalisation par client (multi-instances)

> 📌 Note de réflexion — **à décider et mettre en place le moment venu**. Objectif :
> pouvoir adapter certaines fonctionnalités pour un client sans impacter les autres instances.

**Acquis grâce au Modèle B** : chaque client a son propre Vercel + sa propre base, donc
l'**isolation des données** est totale et tu maîtrises **qui reçoit quoi et quand**
(déployer sur le Vercel d'un client n'affecte pas les autres). Reste à gérer la
**divergence du code** (aujourd'hui : un seul dépôt `main` partagé).

### Stratégies possibles

| Stratégie | Principe | Quand l'utiliser | Coût de maintenance |
|---|---|---|---|
| **Feature flags / config** ⭐ | Un seul code, des interrupteurs activables par instance (variables d'env ou table `settings`/`features` dans chaque base) | Activer/désactiver/paramétrer une fonction (champs, libellés, options de workflow) | Faible — une seule base de code, les correctifs profitent à tous |
| **Branche Git par client** | Une branche longue durée par client (`client/acme`) ; `main` fusionné dedans pour les correctifs communs, spécificités sur la branche ; le Vercel du client déploie sa branche | Fonctionnalité sur-mesure profonde | Moyen/élevé — report des correctifs, conflits possibles |
| **Fork complet** | Un dépôt par client | Cas extrême et unique | Élevé — à éviter en général |

### Recommandation
Approche **hybride** : **feature flags par défaut** (couvre la majorité des besoins), et
**branche dédiée** uniquement pour une divergence profonde. Éviter à tout prix les conditions
« en dur » par client dispersées dans le code → tout centraliser via des flags.

### Piste de mise en œuvre (à faire plus tard)
- Une table `settings` (ou `features`) par instance, lue au démarrage.
- Un hook `useFeature("nom_fonction")` côté front qui lit ces flags.
- Documenter chaque flag (nom, effet, valeur par défaut) ici même.

> ✅ **Conclusion** : c'est tout à fait faisable, rien dans l'état actuel ne le bloque.
> Le seul investissement à prévoir = poser la fondation de feature flags avant d'avoir
> plusieurs clients aux besoins divergents.

---

## 10. Journal des mises à jour de ce guide

> ✍️ À compléter à chaque changement impactant l'installation (nouvelle migration, nouvelle
> variable d'env, nouveau bucket, changement de rôle, etc.). **Quand on ajoute une migration
> au projet, l'ajouter aussi à la liste ordonnée du §2.**

- **2026-06-24** — Création du guide. Schéma = migrations `0001 → 20260623_companies_branches`.
  Bootstrap via `scripts/bootstrap-instance.mjs`. Buckets `photos`/`signatures`.
- **2026-06-24** — Ajout §9 « Personnalisation par client (multi-instances) » : stratégies
  feature flags / branche par client / fork, recommandation hybride (décision à venir).
