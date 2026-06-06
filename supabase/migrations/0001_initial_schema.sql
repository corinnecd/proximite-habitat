-- =============================================================================
-- Proximité Habitat Conseil — Schéma initial
-- Migration 0001 : extensions, enums, tables, index, triggers, buckets storage
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('ADMIN', 'COMMERCIAL', 'PROSPECTEUR');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fiche_status as enum (
    'BROUILLON', 'SOUMISE', 'AFFECTEE', 'ACCEPTEE', 'REFUSEE', 'ARCHIVEE'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Organisations (tenants)
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Profils (1-1 avec auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  email            text not null,
  first_name       text not null,
  last_name        text not null,
  role             public.user_role not null default 'PROSPECTEUR',
  phone            text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists profiles_organization_id_idx on public.profiles (organization_id);

-- -----------------------------------------------------------------------------
-- Fiches de pré-visite
-- -----------------------------------------------------------------------------
create sequence if not exists public.fiche_reference_seq;

create table if not exists public.fiches (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  reference           text unique,
  status              public.fiche_status not null default 'BROUILLON',
  created_by          uuid not null references public.profiles (id),
  assigned_to         uuid references public.profiles (id),

  -- Coordonnées prospect
  prospect_nom        text,
  prospect_prenom     text,
  prospect_adresse    text,
  prospect_cp         text,
  prospect_ville      text,
  prospect_telephone  text,
  disponibilites      text[] not null default '{}',
  date_visite         date,
  heure_visite        text,

  -- Habitation
  annee_construction  integer,
  annee_emmenagement  integer,
  temperature_confort integer,
  surface_chauffee    integer,
  nb_habitants        integer,
  maison_en_vente     boolean,

  -- Chauffage
  modes_chauffage     text[] not null default '{}',
  systemes_chauffage  text[] not null default '{}',
  consommation        text,
  cout_annuel         numeric,

  -- Ventilation
  systemes_ventilation text[] not null default '{}',
  age_ventilation      text,

  -- Isolation & toiture
  nature_isolant      text[] not null default '{}',
  age_isolant         text,
  epaisseur_isolant   text,
  types_pose_toiture  text[] not null default '{}',
  materiaux_toiture   text[] not null default '{}',

  -- Notes & signature
  observations        text,
  signature_url       text,
  consentement_rgpd   boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists fiches_organization_id_idx on public.fiches (organization_id);
create index if not exists fiches_status_idx          on public.fiches (status);
create index if not exists fiches_created_by_idx      on public.fiches (created_by);
create index if not exists fiches_assigned_to_idx     on public.fiches (assigned_to);
create index if not exists fiches_created_at_idx      on public.fiches (created_at desc);

-- -----------------------------------------------------------------------------
-- Historique de fiche (timeline)
-- -----------------------------------------------------------------------------
create table if not exists public.fiche_history (
  id              uuid primary key default gen_random_uuid(),
  fiche_id        uuid not null references public.fiches (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid references public.profiles (id),
  action          text not null,
  old_status      public.fiche_status,
  new_status      public.fiche_status,
  comment         text,
  created_at      timestamptz not null default now()
);
create index if not exists fiche_history_fiche_id_idx on public.fiche_history (fiche_id);

-- -----------------------------------------------------------------------------
-- Photos de fiche
-- -----------------------------------------------------------------------------
create table if not exists public.fiche_photos (
  id              uuid primary key default gen_random_uuid(),
  fiche_id        uuid not null references public.fiches (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_path    text not null,
  original_name   text,
  size            bigint,
  created_at      timestamptz not null default now()
);
create index if not exists fiche_photos_fiche_id_idx on public.fiche_photos (fiche_id);

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type            text not null,
  title           text not null,
  message         text,
  fiche_id        uuid references public.fiches (id) on delete cascade,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists notifications_user_id_idx on public.notifications (user_id, read);

-- -----------------------------------------------------------------------------
-- Triggers : updated_at + génération de référence
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists fiches_set_updated_at on public.fiches;
create trigger fiches_set_updated_at
  before update on public.fiches
  for each row execute function public.set_updated_at();

-- Référence unique générée côté base (PHC-AAAAMMJJ-00001), garantie sans collision.
create or replace function public.set_fiche_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null then
    new.reference := 'PHC-' || to_char(now(), 'YYYYMMDD')
      || '-' || lpad(nextval('public.fiche_reference_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists fiches_set_reference on public.fiches;
create trigger fiches_set_reference
  before insert on public.fiches
  for each row execute function public.set_fiche_reference();

-- -----------------------------------------------------------------------------
-- Buckets Storage (privés)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;
