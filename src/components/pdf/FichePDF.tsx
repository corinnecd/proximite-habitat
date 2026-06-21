"use client";
import {
  Document, Page, Text, View, StyleSheet, Font, Image as PDFImage,
} from "@react-pdf/renderer";
import type { Fiche } from "@/types/database";

// ── Palette ──────────────────────────────────────────────────────────────────

const NAVY  = "#1E3A5F";
const ORANGE = "#F97316";
const GREEN  = "#10B981";
const GREY   = "#64748B";
const LIGHT  = "#F8FAFC";
const BORDER = "#E5E2DB";
const WHITE  = "#FFFFFF";

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: "#1E293B", backgroundColor: WHITE, paddingBottom: 52 },

  // Header
  header: { backgroundColor: NAVY, paddingHorizontal: 36, paddingTop: 30, paddingBottom: 24 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandName: { fontSize: 19, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 0.3 },
  brandSub:  { fontSize: 9, color: "#94A3B8", marginTop: 3 },
  refBox:    { backgroundColor: ORANGE, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, alignItems: "flex-end" },
  refLabel:  { fontSize: 8, color: "#FED7AA", letterSpacing: 0.5 },
  refValue:  { fontSize: 13, fontFamily: "Helvetica-Bold", color: WHITE, marginTop: 2 },
  statusBadge: { marginTop: 7, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 4, alignSelf: "flex-start" },
  statusText:  { fontSize: 8, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 0.6 },

  // Orange band
  band: { backgroundColor: ORANGE, height: 5 },

  // Body
  body: { paddingHorizontal: 36, paddingTop: 26 },

  // Section (utilisé pour obs/photos standalone)
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionDot:    { width: 11, height: 11, borderRadius: 5.5, marginRight: 9 },
  sectionTitle:  { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.2 },
  sectionBody:   { backgroundColor: LIGHT, borderRadius: 6, padding: 16, borderLeft: `3px solid ${ORANGE}` },

  // Grid interne (2 colonnes dans une section)
  grid2: { flexDirection: "row", gap: 0 },
  col:   { flex: 1 },
  field: { marginBottom: 11 },
  label: { fontSize: 8, color: GREY, marginBottom: 3, letterSpacing: 0.4 },
  value: { fontSize: 11, color: "#1E293B", fontFamily: "Helvetica-Bold" },
  valueNone: { fontSize: 11, color: "#94A3B8", fontStyle: "italic" },

  // Paire de sections côte à côte
  pairRow: { flexDirection: "row", gap: 14, marginBottom: 20 },
  pairCol: { flex: 1 },
  pairSection: { marginBottom: 0 },

  // Tags
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 3 },
  tag:     { backgroundColor: "#E0E7FF", borderRadius: 3, paddingHorizontal: 6, paddingVertical: 3 },
  tagText: { fontSize: 8.5, color: NAVY, fontFamily: "Helvetica-Bold" },
  tagGreen:{ backgroundColor: "#D1FAE5" },
  tagGreenText: { color: "#065F46" },

  // Separator
  sep: { borderBottom: `1px solid ${BORDER}`, marginVertical: 20 },

  // Observations
  obsBox: { backgroundColor: "#FFFBEB", border: `1px solid #FDE68A`, borderRadius: 6, padding: 14 },
  obsText: { fontSize: 10, color: "#92400E", lineHeight: 1.5 },

  // RGPD
  rgpdBox: { backgroundColor: "#F0FDF4", border: `1px solid #86EFAC`, borderRadius: 6, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rgpdCheck: { width: 14, height: 14, borderRadius: 3, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", marginTop: 1 },
  rgpdText:  { fontSize: 9.5, color: "#166534", flex: 1, lineHeight: 1.5 },

  // Photos
  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoBox:   { width: "30%", height: 100, borderRadius: 6, overflow: "hidden", backgroundColor: LIGHT },

  // Footer
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: NAVY, paddingHorizontal: 36, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 8, color: "#94A3B8" },
  footerBrand: { fontSize: 8, color: WHITE, fontFamily: "Helvetica-Bold" },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon", SOUMISE: "À valider", AFFECTEE: "Affectée",
  RETRACTATION: "Attente Acceptation Client", ACCEPTEE: "Acceptation Client", REFUSEE: "Refus Client", ARCHIVEE: "Archivé",
};
const STATUS_COLORS: Record<string, string> = {
  BROUILLON: "#64748B", SOUMISE: "#3B82F6", AFFECTEE: "#F97316",
  RETRACTATION: "#8B5CF6", ACCEPTEE: "#10B981", REFUSEE: "#EF4444", ARCHIVEE: "#94A3B8",
};

function Val({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      {value ? <Text style={s.value}>{String(value)}</Text> : <Text style={s.valueNone}>—</Text>}
    </View>
  );
}

function Tags({ label, values, green }: { label: string; values: string[]; green?: boolean }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      {values.length > 0 ? (
        <View style={s.tagsRow}>
          {values.map((v, i) => (
            <View key={i} style={[s.tag, green ? s.tagGreen : {}]}>
              <Text style={[s.tagText, green ? s.tagGreenText : {}]}>{v}</Text>
            </View>
          ))}
        </View>
      ) : <Text style={s.valueNone}>—</Text>}
    </View>
  );
}

function SectionHead({ color, title }: { color: string; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={[s.sectionDot, { backgroundColor: color }]} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

// ── PDF Document ──────────────────────────────────────────────────────────────

export interface FichePDFProps {
  fiche: Fiche;
  referentNom: string;
  commercialNom?: string;
  photoUrls?: string[];
  orgName?: string;
}

export function FichePDF({ fiche, referentNom, commercialNom, photoUrls = [], orgName = "Proximité Habitat Conseil" }: FichePDFProps) {
  const createdAt = new Date(fiche.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const printedAt = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <Document title={`Fiche ${fiche.reference}`} author={orgName} creator={orgName}>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.brandName}>{orgName}</Text>
              <Text style={s.brandSub}>Fiche de pré-visite énergétique</Text>
              <View style={[s.statusBadge, { backgroundColor: STATUS_COLORS[fiche.status] ?? GREY }]}>
                <Text style={s.statusText}>{STATUS_LABELS[fiche.status] ?? fiche.status}</Text>
              </View>
            </View>
            <View style={s.refBox}>
              <Text style={s.refLabel}>RÉFÉRENCE</Text>
              <Text style={s.refValue}>{fiche.reference}</Text>
            </View>
          </View>
        </View>
        <View style={s.band} />

        {/* ── Body ── */}
        <View style={s.body}>

          {/* Infos générales */}
          <View style={s.grid2}>
            <View style={s.col}>
              <Val label="Référent" value={referentNom} />
            </View>
            <View style={s.col}>
              <Val label="Commercial assigné" value={commercialNom ?? undefined} />
            </View>
            <View style={s.col}>
              <Val label="Date de création" value={createdAt} />
            </View>
            <View style={s.col}>
              <Val label="Date de visite souhaitée" value={fiche.date_visite ? new Date(fiche.date_visite).toLocaleDateString("fr-FR") : null} />
            </View>
          </View>

          <View style={s.sep} />

          {/* ── Paire 1 : Coordonnées + Habitation ── */}
          <View style={s.pairRow}>
            <View style={s.pairCol}>
              <View style={s.pairSection}>
                <SectionHead color={NAVY} title="Coordonnées du prospect" />
                <View style={s.sectionBody}>
                  <View style={s.grid2}>
                    <View style={s.col}>
                      <Val label="Nom" value={`${fiche.prospect_prenom ?? ""} ${fiche.prospect_nom ?? ""}`.trim()} />
                      <Val label="Téléphone" value={fiche.prospect_telephone} />
                    </View>
                    <View style={s.col}>
                      <Val label="Adresse" value={fiche.prospect_adresse} />
                      <Val label="Ville" value={fiche.prospect_cp && fiche.prospect_ville ? `${fiche.prospect_cp} ${fiche.prospect_ville}` : fiche.prospect_ville} />
                    </View>
                  </View>
                  {(fiche.disponibilites?.length ?? 0) > 0 && (
                    <Tags label="Disponibilités" values={fiche.disponibilites ?? []} />
                  )}
                  {fiche.heure_visite && <Val label="Heure souhaitée" value={fiche.heure_visite} />}
                </View>
              </View>
            </View>

            <View style={s.pairCol}>
              <View style={s.pairSection}>
                <SectionHead color="#6366F1" title="Habitation" />
                <View style={s.sectionBody}>
                  <View style={s.grid2}>
                    <View style={s.col}>
                      <Val label="Année de construction" value={fiche.annee_construction} />
                      <Val label="Surface chauffée" value={fiche.surface_chauffee ? `${fiche.surface_chauffee} m²` : null} />
                      <Val label="Température de confort" value={fiche.temperature_confort ? `${fiche.temperature_confort} °C` : null} />
                    </View>
                    <View style={s.col}>
                      <Val label="Emménagement" value={fiche.annee_emmenagement} />
                      <Val label="Nombre d'habitants" value={fiche.nb_habitants} />
                      <Val label="Maison en vente" value={fiche.maison_en_vente === true ? "Oui" : fiche.maison_en_vente === false ? "Non" : null} />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ── Paire 2 : Chauffage + Ventilation ── */}
          <View style={s.pairRow}>
            <View style={s.pairCol}>
              <View style={s.pairSection}>
                <SectionHead color={ORANGE} title="Chauffage" />
                <View style={s.sectionBody}>
                  <View style={s.grid2}>
                    <View style={s.col}>
                      <Tags label="Modes de chauffage" values={fiche.modes_chauffage ?? []} />
                      <Val label="Consommation" value={fiche.consommation} />
                    </View>
                    <View style={s.col}>
                      <Tags label="Systèmes" values={fiche.systemes_chauffage ?? []} />
                      <Val label="Coût annuel" value={fiche.cout_annuel ? `${fiche.cout_annuel} €` : null} />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={s.pairCol}>
              <View style={s.pairSection}>
                <SectionHead color="#0EA5E9" title="Ventilation" />
                <View style={s.sectionBody}>
                  <View style={s.grid2}>
                    <View style={s.col}>
                      <Tags label="Systèmes de ventilation" values={fiche.systemes_ventilation ?? []} />
                    </View>
                    <View style={s.col}>
                      <Val label="Âge du système" value={fiche.age_ventilation} />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ── Paire 3 : Isolation & Toiture + Consentement RGPD ── */}
          <View style={s.pairRow}>
            <View style={s.pairCol}>
              <View style={s.pairSection}>
                <SectionHead color={GREEN} title="Isolation & Toiture" />
                <View style={s.sectionBody}>
                  <View style={s.grid2}>
                    <View style={s.col}>
                      <Tags label="Nature de l'isolant" values={fiche.nature_isolant ?? []} green />
                      <Val label="Âge de l'isolant" value={fiche.age_isolant} />
                      <Val label="Épaisseur" value={fiche.epaisseur_isolant} />
                    </View>
                    <View style={s.col}>
                      <Tags label="Type de pose toiture" values={fiche.types_pose_toiture ?? []} />
                      <Tags label="Matériaux toiture" values={fiche.materiaux_toiture ?? []} />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={s.pairCol}>
              <View style={s.pairSection}>
                <SectionHead color={GREEN} title="Consentement RGPD" />
                <View style={s.sectionBody}>
                  <View style={fiche.consentement_rgpd ? s.rgpdBox : { ...s.rgpdBox, backgroundColor: "#FEF2F2", borderColor: "#FECACA" }}>
                    <View style={[s.rgpdCheck, { backgroundColor: fiche.consentement_rgpd ? GREEN : "#EF4444" }]}>
                      <Text style={{ fontSize: 8, color: WHITE, fontFamily: "Helvetica-Bold" }}>
                        {fiche.consentement_rgpd ? "✓" : "✗"}
                      </Text>
                    </View>
                    <Text style={[s.rgpdText, { color: fiche.consentement_rgpd ? "#166534" : "#991B1B" }]}>
                      {fiche.consentement_rgpd
                        ? "Consentement obtenu — Le prospect a été informé de la collecte et du traitement de ses données personnelles."
                        : "Consentement non renseigné."}
                    </Text>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Val label="Date de création" value={new Date(fiche.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} />
                    {commercialNom && <Val label="Commercial assigné" value={commercialNom} />}
                  </View>
                </View>
              </View>
            </View>
          </View>

        </View>

        {/* ── Footer page 1 ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Réf. {fiche.reference} · Imprimé le {printedAt}</Text>
          <Text style={s.footerBrand}>{orgName}</Text>
          <Text style={s.footerText}>Document confidentiel</Text>
        </View>

      </Page>

      {/* ── Page 2 : Observations + Photos (uniquement si présentes) ── */}
      {(fiche.observations || photoUrls.length > 0) && (
        <Page size="A4" style={s.page}>

          {/* Mini en-tête page 2 */}
          <View style={{ backgroundColor: NAVY, paddingHorizontal: 36, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: WHITE }}>{orgName}</Text>
              <Text style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>Fiche de pré-visite énergétique — suite</Text>
            </View>
            <View style={s.refBox}>
              <Text style={s.refLabel}>RÉFÉRENCE</Text>
              <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: WHITE, marginTop: 2 }}>{fiche.reference}</Text>
            </View>
          </View>
          <View style={s.band} />

          <View style={{ paddingHorizontal: 36, paddingTop: 24 }}>

            {/* Observations */}
            {fiche.observations && (
              <View style={s.section}>
                <SectionHead color="#F59E0B" title="Observations" />
                <View style={s.obsBox}>
                  <Text style={s.obsText}>{fiche.observations}</Text>
                </View>
              </View>
            )}

            {/* Photos */}
            {photoUrls.length > 0 && (
              <View style={s.section}>
                <SectionHead color="#8B5CF6" title={`Photos (${photoUrls.length})`} />
                <View style={s.photosGrid}>
                  {photoUrls.slice(0, 9).map((url, i) => (
                    <View key={i} style={s.photoBox}>
                      <PDFImage src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </View>
                  ))}
                </View>
              </View>
            )}

          </View>

          {/* Footer page 2 */}
          <View style={s.footer}>
            <Text style={s.footerText}>Réf. {fiche.reference} · Imprimé le {printedAt}</Text>
            <Text style={s.footerBrand}>{orgName}</Text>
            <Text style={s.footerText}>Document confidentiel</Text>
          </View>

        </Page>
      )}

    </Document>
  );
}
