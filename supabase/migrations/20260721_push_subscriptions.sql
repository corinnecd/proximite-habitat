-- Table pour stocker les abonnements Web Push par utilisateur
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null,
  keys_auth   text not null,
  keys_p256dh text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- Index pour les lookups par user_id (envoi de push)
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

-- RLS : chaque utilisateur ne voit que ses propres abonnements
alter table public.push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Le service role (API route /api/push/send) peut lire toutes les subscriptions
-- → géré via SUPABASE_SERVICE_ROLE_KEY dans les routes API, pas besoin de policy supplémentaire
