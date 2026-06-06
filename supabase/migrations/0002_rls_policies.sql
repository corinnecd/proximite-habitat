-- =============================================================================
-- Proximité Habitat Conseil — Row Level Security
-- Migration 0002 : helpers SECURITY DEFINER + politiques par organisation + rôle
-- =============================================================================
-- Modèle de sécurité :
--   * Isolation stricte par organisation (multi-tenant) sur TOUTES les tables.
--   * ADMIN / COMMERCIAL voient toute leur organisation ; PROSPECTEUR ne voit
--     que les fiches qu'il a créées ou qui lui sont affectées.
--   * Le client n'utilise que la clé `anon` : ces politiques sont l'unique
--     barrière réelle. La clé `service_role` (seed, /api/users) les contourne.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers : lisent le profil courant sans déclencher de récursion RLS.
-- -----------------------------------------------------------------------------
create or replace function public.app_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Activation de RLS
-- -----------------------------------------------------------------------------
alter table public.organizations  enable row level security;
alter table public.profiles       enable row level security;
alter table public.fiches         enable row level security;
alter table public.fiche_history  enable row level security;
alter table public.fiche_photos   enable row level security;
alter table public.notifications  enable row level security;

-- =============================================================================
-- ORGANIZATIONS — lecture de sa propre organisation uniquement
-- =============================================================================
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = public.app_org_id());

-- =============================================================================
-- PROFILES
-- =============================================================================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or organization_id = public.app_org_id());

-- Chacun met à jour son propre profil ; un ADMIN gère ceux de son organisation.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (
    id = auth.uid()
    or (public.app_role() = 'ADMIN' and organization_id = public.app_org_id())
  )
  with check (
    id = auth.uid()
    or (public.app_role() = 'ADMIN' and organization_id = public.app_org_id())
  );

-- Création réservée aux ADMIN de l'organisation (l'API /api/users passe en
-- service_role et contourne cette règle pour le bootstrap initial).
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (
    public.app_role() = 'ADMIN' and organization_id = public.app_org_id()
  );

-- =============================================================================
-- FICHES
-- =============================================================================
-- Visibilité : admins/commerciaux voient toute l'org ; un prospecteur ne voit
-- que ses fiches ou celles qui lui sont affectées.
drop policy if exists fiches_select on public.fiches;
create policy fiches_select on public.fiches
  for select to authenticated
  using (
    organization_id = public.app_org_id()
    and (
      public.app_role() in ('ADMIN', 'COMMERCIAL')
      or created_by = auth.uid()
      or assigned_to = auth.uid()
    )
  );

-- Création : par un membre de l'organisation, en tant qu'auteur.
drop policy if exists fiches_insert on public.fiches;
create policy fiches_insert on public.fiches
  for insert to authenticated
  with check (
    organization_id = public.app_org_id()
    and created_by = auth.uid()
  );

-- Modification : ADMIN sur toute l'org, COMMERCIAL sur les fiches affectées,
-- PROSPECTEUR sur ses propres fiches.
drop policy if exists fiches_update on public.fiches;
create policy fiches_update on public.fiches
  for update to authenticated
  using (
    organization_id = public.app_org_id()
    and (
      public.app_role() = 'ADMIN'
      or (public.app_role() = 'COMMERCIAL' and assigned_to = auth.uid())
      or (public.app_role() = 'PROSPECTEUR' and created_by = auth.uid())
    )
  )
  with check (organization_id = public.app_org_id());

-- Suppression : son propre brouillon, ou un ADMIN.
drop policy if exists fiches_delete on public.fiches;
create policy fiches_delete on public.fiches
  for delete to authenticated
  using (
    organization_id = public.app_org_id()
    and (
      public.app_role() = 'ADMIN'
      or (created_by = auth.uid() and status = 'BROUILLON')
    )
  );

-- =============================================================================
-- FICHE_HISTORY — adossé à la visibilité de la fiche
-- =============================================================================
drop policy if exists fiche_history_select on public.fiche_history;
create policy fiche_history_select on public.fiche_history
  for select to authenticated
  using (
    exists (
      select 1 from public.fiches f
      where f.id = fiche_history.fiche_id
        and f.organization_id = public.app_org_id()
    )
  );

drop policy if exists fiche_history_insert on public.fiche_history;
create policy fiche_history_insert on public.fiche_history
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.fiches f
      where f.id = fiche_history.fiche_id
        and f.organization_id = public.app_org_id()
    )
  );

-- =============================================================================
-- FICHE_PHOTOS — adossé à la visibilité de la fiche
-- =============================================================================
drop policy if exists fiche_photos_select on public.fiche_photos;
create policy fiche_photos_select on public.fiche_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.fiches f
      where f.id = fiche_photos.fiche_id
        and f.organization_id = public.app_org_id()
    )
  );

drop policy if exists fiche_photos_insert on public.fiche_photos;
create policy fiche_photos_insert on public.fiche_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.fiches f
      where f.id = fiche_photos.fiche_id
        and f.organization_id = public.app_org_id()
    )
  );

drop policy if exists fiche_photos_delete on public.fiche_photos;
create policy fiche_photos_delete on public.fiche_photos
  for delete to authenticated
  using (
    exists (
      select 1 from public.fiches f
      where f.id = fiche_photos.fiche_id
        and f.organization_id = public.app_org_id()
    )
  );

-- =============================================================================
-- NOTIFICATIONS — chacun ne voit que les siennes
-- =============================================================================
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- Insertion : on peut notifier un membre de sa propre organisation
-- (ex. affectation d'une fiche à un commercial, retour au prospecteur).
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = notifications.user_id
        and p.organization_id = public.app_org_id()
    )
  );

-- =============================================================================
-- STORAGE — buckets privés "photos" et "signatures"
-- =============================================================================
-- Accès réservé aux utilisateurs authentifiés sur ces deux buckets.
-- Recommandation : préfixer les chemins par l'organisation/fiche et durcir ces
-- politiques (storage.foldername) pour une isolation par organisation au niveau
-- des objets eux-mêmes.
drop policy if exists storage_phc_select on storage.objects;
create policy storage_phc_select on storage.objects
  for select to authenticated
  using (bucket_id in ('photos', 'signatures'));

drop policy if exists storage_phc_insert on storage.objects;
create policy storage_phc_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('photos', 'signatures'));

drop policy if exists storage_phc_delete on storage.objects;
create policy storage_phc_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('photos', 'signatures'));
