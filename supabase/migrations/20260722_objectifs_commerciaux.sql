-- Table des objectifs mensuels par commercial
create table if not exists public.objectifs_commerciaux (
  id uuid primary key default gen_random_uuid(),
  commercial_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_month date not null,
  objectif_fiches int not null default 0,
  objectif_ca numeric not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_commercial_month unique (commercial_id, period_month)
);

-- Index pour les requêtes par mois et par organisation
create index if not exists idx_objectifs_commercial on public.objectifs_commerciaux(commercial_id, period_month);
create index if not exists idx_objectifs_org_month on public.objectifs_commerciaux(organization_id, period_month);

-- RLS
alter table public.objectifs_commerciaux enable row level security;

-- Admin/DG peuvent tout voir et modifier
create policy "objectifs_select_admin" on public.objectifs_commerciaux
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('ADMIN', 'DIRECTION_GENERALE')
    )
  );

create policy "objectifs_insert_admin" on public.objectifs_commerciaux
  for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('ADMIN', 'DIRECTION_GENERALE')
    )
  );

create policy "objectifs_update_admin" on public.objectifs_commerciaux
  for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('ADMIN', 'DIRECTION_GENERALE')
    )
  );

create policy "objectifs_delete_admin" on public.objectifs_commerciaux
  for delete using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('ADMIN', 'DIRECTION_GENERALE')
    )
  );

-- Les commerciaux peuvent lire leurs propres objectifs
create policy "objectifs_select_own" on public.objectifs_commerciaux
  for select using (commercial_id = auth.uid());
