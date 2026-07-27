-- Ajout de la policy UPDATE manquante sur les buckets photos et signatures.
-- Sans cette policy, upsert échoue silencieusement quand le fichier existe déjà.
drop policy if exists storage_phc_update on storage.objects;
create policy storage_phc_update on storage.objects
  for update to authenticated
  using (bucket_id in ('photos', 'signatures'));
