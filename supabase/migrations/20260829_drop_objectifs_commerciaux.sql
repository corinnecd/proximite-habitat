-- 20260829_drop_objectifs_commerciaux.sql
-- La fonctionnalité "objectifs commerciaux" a été retirée du produit (voir
-- MODIFICATIONS.md 2026-08-29). Plus aucun code ne lit ou n'écrit cette table,
-- et elle est vide. Suppression définitive.

drop table if exists public.objectifs_commerciaux;
