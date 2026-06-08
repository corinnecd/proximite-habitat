"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { getFicheById, getFichePhotos } from "@/lib/data/fiches";
import { getProfileFullName } from "@/lib/data/profiles";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/permissions";
import type { Fiche } from "@/types/database";
import { Printer, Loader2 } from "lucide-react";

interface PhotoRow { id: string; storage_path: string; original_name: string | null; }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 text-sm py-1.5 border-b border-gray-100 last:border-0">
      <span className="w-44 shrink-0 text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 flex-1">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3 pb-1 border-b-2 border-gray-200">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function ImprimerFichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [creatorName, setCreatorName] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [ficheData, photosData] = await Promise.all([
        getFicheById(supabase, id),
        getFichePhotos(supabase, id),
      ]);
      if (ficheData) {
        setFiche(ficheData);
        if (ficheData.created_by) {
          const name = await getProfileFullName(supabase, ficheData.created_by);
          if (name) setCreatorName(name);
        }
      }
      setPhotos(photosData);
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!fiche) {
    return <div className="p-8 text-center text-gray-500">Fiche introuvable</div>;
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="no-print sticky top-0 bg-gray-50 border-b px-8 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-600">Fiche {fiche.reference}</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Printer className="w-4 h-4" />Imprimer / Enregistrer en PDF
        </button>
      </div>

      {/* Contenu imprimable */}
      <div className="max-w-3xl mx-auto px-8 py-10">
        {/* En-tête */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-800">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[#F97316] mb-1">
              Proximité Habitat Conseil
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Fiche de prospection
            </h1>
            <p className="text-gray-500 text-sm mt-1">{fiche.reference}</p>
          </div>
          <div className="text-right text-sm text-gray-500 space-y-0.5">
            <p>Statut : <span className="font-semibold text-gray-800">{STATUS_LABELS[fiche.status]}</span></p>
            <p>Date : {new Date(fiche.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
            {creatorName && <p>Prospecteur : <span className="font-semibold text-gray-800">{creatorName}</span></p>}
          </div>
        </div>

        {/* Coordonnées */}
        <Section title="Coordonnées du prospect">
          <Row label="Nom complet" value={`${fiche.prospect_prenom} ${fiche.prospect_nom}`} />
          <Row label="Adresse" value={`${fiche.prospect_adresse}, ${fiche.prospect_cp} ${fiche.prospect_ville}`} />
          <Row label="Téléphone" value={fiche.prospect_telephone} />
          <Row label="Disponibilités" value={(fiche.disponibilites || []).join(", ") || null} />
          <Row label="Date de visite" value={fiche.date_visite ? new Date(fiche.date_visite).toLocaleDateString("fr-FR") : null} />
          <Row label="Heure souhaitée" value={fiche.heure_visite} />
        </Section>

        {/* Habitation */}
        <Section title="Habitation">
          <Row label="Année de construction" value={fiche.annee_construction} />
          <Row label="Année d'emménagement" value={fiche.annee_emmenagement} />
          <Row label="Surface chauffée" value={fiche.surface_chauffee ? `${fiche.surface_chauffee} m²` : null} />
          <Row label="Nb. habitants" value={fiche.nb_habitants} />
          <Row label="Température confort" value={fiche.temperature_confort ? `${fiche.temperature_confort} °C` : null} />
          <Row label="Maison en vente" value={fiche.maison_en_vente === true ? "Oui" : fiche.maison_en_vente === false ? "Non" : null} />
        </Section>

        {/* Chauffage */}
        <Section title="Chauffage">
          <Row label="Modes de chauffage" value={(fiche.modes_chauffage || []).join(", ") || null} />
          <Row label="Systèmes" value={(fiche.systemes_chauffage || []).join(", ") || null} />
          <Row label="Consommation" value={fiche.consommation} />
          <Row label="Coût annuel" value={fiche.cout_annuel ? `${fiche.cout_annuel} €` : null} />
        </Section>

        {/* Ventilation */}
        <Section title="Ventilation">
          <Row label="Systèmes" value={(fiche.systemes_ventilation || []).join(", ") || null} />
          <Row label="Âge" value={fiche.age_ventilation} />
        </Section>

        {/* Isolation */}
        <Section title="Isolation & Toiture">
          <Row label="Nature isolant" value={(fiche.nature_isolant || []).join(", ") || null} />
          <Row label="Âge isolant" value={fiche.age_isolant} />
          <Row label="Épaisseur" value={fiche.epaisseur_isolant} />
          <Row label="Types pose toiture" value={(fiche.types_pose_toiture || []).join(", ") || null} />
          <Row label="Matériaux toiture" value={(fiche.materiaux_toiture || []).join(", ") || null} />
        </Section>

        {/* Observations */}
        {fiche.observations && (
          <Section title="Observations">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{fiche.observations}</p>
          </Section>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <Section title={`Photos (${photos.length})`}>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {photos.map((p) => {
                const { data } = supabase.storage.from("photos").getPublicUrl(p.storage_path);
                return (
                  <img key={p.id} src={data.publicUrl} alt={p.original_name ?? ""}
                    className="w-full h-32 object-cover rounded-lg border border-gray-200" />
                );
              })}
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-200 flex items-start justify-between text-xs text-gray-400">
          <div>
            {fiche.consentement_rgpd && (
              <Badge variant="secondary" className="bg-green-50 text-green-700 text-xs">
                ✓ Consentement RGPD obtenu
              </Badge>
            )}
          </div>
          <div className="text-right">
            <p>Imprimé le {new Date().toLocaleDateString("fr-FR")}</p>
            <p className="mt-0.5">Ref : {fiche.reference}</p>
          </div>
        </div>
      </div>

      {/* CSS d'impression inline */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; }
          @page { margin: 15mm; }
        }
      `}</style>
    </div>
  );
}
