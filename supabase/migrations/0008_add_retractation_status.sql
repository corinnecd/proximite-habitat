-- Migration 0008 : ajout du statut RETRACTATION dans l'enum fiche_status
-- Ce statut s'insère entre ACCEPTEE et ARCHIVEE dans le workflow.
-- ACCEPTEE → RETRACTATION (délai de rétractation légal) → ARCHIVEE
--                                                        → AFFECTEE (si rétractation annulée)

alter type public.fiche_status add value if not exists 'RETRACTATION' after 'ACCEPTEE';
