"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VilleMapDynamic } from "@/components/ui/VilleMapDynamic";
import {
  SectionCard, DataRow, PhotoThumb,
} from "@/components/fiches/FicheDetailHelpers";
import type { HistoryEntry, PhotoEntry, ProfileEntry } from "@/components/fiches/FicheDetailHelpers";
import { canEditRdvDate } from "@/lib/permissions";
import { toast } from "sonner";
import {
  User, Home, Flame, Wind, Shield, Camera, FileText, MapPin, Phone, Calendar, CheckCircle2, ShieldCheck, PenTool,
} from "lucide-react";
import type { Fiche, ZoneVille, Profile } from "@/types/database";
import type { createClient } from "@/lib/supabase/client";

// Historique n'est pas utilisé ici mais réexporté pour cohérence de typage des consommateurs
export type { HistoryEntry };

interface FicheMainContentProps {
  fiche: Fiche;
  villeData: ZoneVille | null;
  editingRdvDate: boolean;
  setEditingRdvDate: (v: boolean) => void;
  rdvDateValue: string;
  setRdvDateValue: (v: string) => void;
  profile: Profile | null;
  supabase: ReturnType<typeof createClient>;
  setFiche: (f: Fiche) => void;
  photos: PhotoEntry[];
  signatureUrl: string | null;
  referentSignatureUrl: string | null;
  commercials: ProfileEntry[];
}

export function FicheMainContent({
  fiche, villeData, editingRdvDate, setEditingRdvDate, rdvDateValue, setRdvDateValue,
  profile, supabase, setFiche, photos, signatureUrl, referentSignatureUrl, commercials,
}: FicheMainContentProps) {
  return (
    <div className="lg:col-span-2 space-y-4">

      {/* ── PDF PAIR 1 : Coordonnées + Habitation ─── */}
      <div data-pdf-pair className="grid grid-cols-1 sm:grid-cols-2 gap-4">

      {/* Coordonnées */}
      <SectionCard
        icon={<User className="w-4 h-4" />}
        iconBg="bg-blue-50 dark:bg-blue-950/30"
        iconColor="text-blue-600"
        title="Coordonnées du prospect"
      >
        <div className="grid grid-cols-2 gap-4">
          <DataRow label="Nom" value={fiche.prospect_nom} />
          <DataRow label="Prénom" value={fiche.prospect_prenom} />
          <div className="col-span-2">
            <DataRow
              label="Adresse"
              value={
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {[fiche.prospect_adresse, [fiche.prospect_cp, fiche.prospect_ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}
                </span>
              }
            />
          </div>
          {villeData && (
            <div className="col-span-2" data-no-print>
              <VilleMapDynamic lat={villeData.lat} lng={villeData.lng} villeNom={villeData.nom} />
            </div>
          )}
          <DataRow
            label="Téléphone"
            value={
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {fiche.prospect_telephone}
              </span>
            }
          />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Disponibilités</p>
            <div className="flex gap-1 flex-wrap">
              {(fiche.disponibilites || []).length > 0
                ? (fiche.disponibilites || []).map((j) => (
                    <Badge key={j} variant="secondary" className="text-xs rounded-lg">{j}</Badge>
                  ))
                : <span className="text-sm text-muted-foreground/60">—</span>
              }
            </div>
          </div>
          <div className="col-span-2">
            <DataRow
              label="Visite souhaitée"
              value={
                fiche.date_visite ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {new Date(fiche.date_visite).toLocaleDateString("fr-FR", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric",
                    })}
                    {fiche.heure_visite && ` à ${fiche.heure_visite}`}
                  </span>
                ) : null
              }
            />
          </div>
          <div className="col-span-2">
            <DataRow
              label="Date de rendez-vous"
              value={
                editingRdvDate ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={rdvDateValue}
                      onChange={(e) => setRdvDateValue(e.target.value)}
                      onKeyDown={(e) => e.preventDefault()}
                      className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
                    />
                    <Button size="sm" className="rounded-lg h-8 text-xs" onClick={async () => {
                      if (!fiche || !profile) return;
                      const oldDate = fiche.rdv_date;
                      await supabase.from("fiches").update({ rdv_date: rdvDateValue || null }).eq("id", fiche.id);
                      await supabase.from("fiche_history").insert({
                        fiche_id: fiche.id,
                        organization_id: profile.organization_id,
                        user_id: profile.id,
                        action: "MODIFICATION_RDV",
                        comment: `Date de RDV modifiée : ${oldDate || "non définie"} → ${rdvDateValue || "non définie"}`,
                      });
                      setFiche({ ...fiche, rdv_date: rdvDateValue || null });
                      setEditingRdvDate(false);
                      toast.success("Date de rendez-vous mise à jour");
                    }}>
                      Enregistrer
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-lg h-8 text-xs" onClick={() => setEditingRdvDate(false)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {fiche.rdv_date
                      ? new Date(fiche.rdv_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                      : "Non définie"}
                    {profile && canEditRdvDate(profile.role, profile.id, fiche.created_by, fiche.assigned_to, fiche.status) && (
                      <button
                        type="button"
                        onClick={() => { setRdvDateValue(fiche.rdv_date || ""); setEditingRdvDate(true); }}
                        className="ml-2 min-h-8 px-1 text-xs text-primary hover:underline"
                      >
                        Modifier
                      </button>
                    )}
                  </span>
                )
              }
            />
          </div>
        </div>
      </SectionCard>

      {/* Habitation — ferme la pair 1 */}
      <SectionCard
        icon={<Home className="w-4 h-4" />}
        iconBg="bg-primary/10"
        iconColor="text-primary"
        title="Caractéristiques du logement"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <DataRow label="Année construction" value={fiche.annee_construction} />
          <DataRow label="Année emménagement" value={fiche.annee_emmenagement} />
          <DataRow label="Surface chauffée" value={fiche.surface_chauffee ? `${fiche.surface_chauffee} m²` : null} />
          <DataRow label="Nb habitants" value={fiche.nb_habitants} />
          <DataRow label="T° confort" value={fiche.temperature_confort ? `${fiche.temperature_confort} °C` : null} />
          <DataRow
            label="Maison en vente"
            value={
              fiche.maison_en_vente === true ? (
                <span className="text-orange-600 font-semibold">Oui</span>
              ) : fiche.maison_en_vente === false ? "Non" : null
            }
          />
        </div>
      </SectionCard>
      </div>{/* fin pdf-pair 1 */}

      {/* ── PDF PAIR 2 : Chauffage + Ventilation ─── */}
      <div data-pdf-pair className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SectionCard
        icon={<Flame className="w-4 h-4" />}
        iconBg="bg-orange-50 dark:bg-orange-950/30"
        iconColor="text-orange-500"
        title="Chauffage"
      >
        <div className="space-y-3">
          {(fiche.modes_chauffage || []).length > 0 || (fiche.systemes_chauffage || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(fiche.modes_chauffage || []).map((m) => (
                <Badge key={m} variant="secondary" className="rounded-lg">{m}</Badge>
              ))}
              {(fiche.systemes_chauffage || []).map((s) => (
                <Badge key={s} variant="outline" className="rounded-lg">{s}</Badge>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground/60">Non renseigné</p>}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <DataRow label="Consommation" value={fiche.consommation} />
            <DataRow label="Coût annuel" value={fiche.cout_annuel ? `${fiche.cout_annuel} €` : null} />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Wind className="w-4 h-4" />}
        iconBg="bg-cyan-50 dark:bg-cyan-950/30"
        iconColor="text-cyan-600"
        title="Ventilation"
      >
        <div className="space-y-2">
          {(fiche.systemes_ventilation || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(fiche.systemes_ventilation || []).map((v) => (
                <Badge key={v} variant="secondary" className="rounded-lg">{v}</Badge>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground/60">Non renseigné</p>}
          <DataRow label="Âge" value={fiche.age_ventilation} />
        </div>
      </SectionCard>
      </div>{/* fin pdf-pair 2 */}

      {/* ── PDF PAIR 3 : Isolation + Consentement RGPD ─── */}
      <div data-pdf-pair className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SectionCard
        icon={<Shield className="w-4 h-4" />}
        iconBg="bg-emerald-50 dark:bg-emerald-950/30"
        iconColor="text-emerald-600"
        title="Isolation & Toiture"
      >
        <div className="space-y-2">
          {(fiche.nature_isolant || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(fiche.nature_isolant || []).map((n) => (
                <Badge key={n} variant="secondary" className="rounded-lg">{n}</Badge>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground/60">Non renseigné</p>}
          <DataRow label="Épaisseur" value={fiche.epaisseur_isolant} />
          {(fiche.materiaux_toiture || []).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {(fiche.materiaux_toiture || []).map((m) => (
                <Badge key={m} variant="outline" className="rounded-lg text-xs">{m}</Badge>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Consentement RGPD */}
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-4 hover:shadow-md transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-sm">Consentement RGPD</h3>
        </div>
        <div className="space-y-3">
          <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
            fiche.consentement_rgpd
              ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
              : "bg-muted border border-border"
          }`}>
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${fiche.consentement_rgpd ? "text-emerald-600" : "text-muted-foreground"}`} />
            <span className={`text-xs font-medium ${fiche.consentement_rgpd ? "text-emerald-800 dark:text-emerald-300" : "text-muted-foreground"}`}>
              {fiche.consentement_rgpd ? "Consentement obtenu" : "Non renseigné"}
            </span>
          </div>
          <DataRow label="Créée le" value={new Date(fiche.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} />
          <DataRow label="Modifiée le" value={new Date(fiche.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} />
          {fiche.assigned_to && (() => {
            const c = commercials.find((x) => x.id === fiche.assigned_to);
            return c ? <DataRow label="Commercial" value={`${c.first_name} ${c.last_name}`} /> : null;
          })()}
        </div>
      </div>
      </div>{/* fin pdf-pair 3 */}

      {/* En-tête page 2 — masqué via style inline (pas Tailwind) pour que le CSS print puisse l'overrider */}
      <div data-pdf-page2-header style={{ display: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "6px", borderBottom: "2px solid #F97316", marginBottom: "10px" }}>
          <div>
            <span style={{ display: "block", fontWeight: 700, fontSize: "14px", color: "#0F172A" }}>Proximité Habitat Conseil</span>
            <span style={{ display: "block", fontSize: "11px", color: "#64748B" }}>Fiche de pré-visite énergétique — suite</span>
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#F97316" }}>{fiche.reference}</span>
        </div>
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <div data-pdf-photos>
        <SectionCard
          icon={<Camera className="w-4 h-4" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          iconColor="text-slate-600"
          title={`Photos (${photos.length})`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <PhotoThumb key={photo.id} url={photo.signedUrl} name={photo.original_name ?? ""} />
            ))}
          </div>
        </SectionCard>
        </div>
      )}

      {/* Signatures */}
      {(signatureUrl || referentSignatureUrl) && (
        <SectionCard
          icon={<PenTool className="w-4 h-4" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/30"
          iconColor="text-emerald-600"
          title="Signatures"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {signatureUrl && (
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Signature du prospect</p>
                <div className="rounded-xl border border-border bg-white p-3">
                  <Image src={signatureUrl} alt="Signature prospect" width={300} height={90} className="max-h-20 w-auto object-contain" unoptimized />
                </div>
              </div>
            )}
            {referentSignatureUrl && (
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Signature du référent</p>
                <div className="rounded-xl border border-border bg-white p-3">
                  <Image src={referentSignatureUrl} alt="Signature référent" width={300} height={90} className="max-h-20 w-auto object-contain" unoptimized />
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Observations */}
      {fiche.observations && (
        <SectionCard
          icon={<FileText className="w-4 h-4" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          iconColor="text-slate-600"
          title="Observations"
        >
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {fiche.observations}
          </p>
        </SectionCard>
      )}
    </div>
  );
}
