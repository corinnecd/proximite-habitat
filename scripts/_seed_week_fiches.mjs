import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_PHC = "6245a558-4ebe-4df7-8082-324ef8edf88b";
const ADMIN_ID = "1397a234-1dc9-4592-b2a6-0a53f94118f9"; // Marie Direction

const COMMERCIALS = {
  sophie: "5382e5f5-e568-4723-9a99-7cfdf451f4c2",
  lucas: "6e091370-38e3-4698-bdbf-6d2fe67d9bcb",
  nicolas: "31e154d9-5583-4a49-ade8-2cd87ada6d1f",
  isabelle: "2fcf1f1a-d62e-48c9-bce3-26bc7d15f2d2",
  antoine: "3cd07561-3384-495e-aefa-2193c9d4aca1",
  paul: "36317b04-aa47-44c3-a2fe-5197feccdfea",
  marie: "bdf36e33-27c6-4275-829d-76087f16f02d",
  lea: "9f654b46-9c9a-413c-975e-f64b2dc3e54a",
  hugo: "71de29b1-851d-44f8-9aa2-b83ade911210",
};

function ref(dateStr) {
  const d = dateStr.replaceAll("-", "");
  const rand = Math.floor(10000 + Math.random() * 89999);
  return `PHC-${d}-${rand}`;
}

const base = {
  organization_id: ORG_PHC,
  created_by: ADMIN_ID,
  prospect_adresse: "12 rue des Tests",
  prospect_cp: "59000",
  prospect_ville: "Lille",
  consentement_rgpd: true,
};

const rows = [
  // 2 VALIDEE (validées, pas encore affectées)
  { ...base, reference: ref("2026-07-20"), status: "VALIDEE", prospect_nom: "Fontaine", prospect_prenom: "Camille", prospect_telephone: "0612340001" },
  { ...base, reference: ref("2026-07-20"), status: "VALIDEE", prospect_nom: "Girard", prospect_prenom: "Thomas", prospect_telephone: "0612340002" },

  // 5 AFFECTEE avec RDV cette semaine
  { ...base, reference: ref("2026-07-21"), status: "AFFECTEE", assigned_to: COMMERCIALS.sophie, rdv_date: "2026-07-21", heure_visite: "09:00", prospect_nom: "Petit", prospect_prenom: "Julien", prospect_telephone: "0612340003" },
  { ...base, reference: ref("2026-07-22"), status: "AFFECTEE", assigned_to: COMMERCIALS.lucas, rdv_date: "2026-07-22", heure_visite: "10:30", prospect_nom: "Roy", prospect_prenom: "Manon", prospect_telephone: "0612340004" },
  { ...base, reference: ref("2026-07-23"), status: "AFFECTEE", assigned_to: COMMERCIALS.isabelle, rdv_date: "2026-07-23", heure_visite: "14:00", prospect_nom: "Blanchard", prospect_prenom: "Karim", prospect_telephone: "0612340005" },
  { ...base, reference: ref("2026-07-24"), status: "AFFECTEE", assigned_to: COMMERCIALS.antoine, rdv_date: "2026-07-24", heure_visite: "11:00", prospect_nom: "Gauthier", prospect_prenom: "Emma", prospect_telephone: "0612340006" },
  { ...base, reference: ref("2026-07-25"), status: "AFFECTEE", assigned_to: COMMERCIALS.paul, rdv_date: "2026-07-25", heure_visite: "16:00", prospect_nom: "Perrin", prospect_prenom: "Nicolas", prospect_telephone: "0612340007" },

  // 3 REFUSEE avec 3 motifs différents
  { ...base, reference: ref("2026-07-21"), status: "REFUSEE", assigned_to: COMMERCIALS.marie, motif_refus: "RDC", prospect_nom: "Colin", prospect_prenom: "Aline", prospect_telephone: "0612340008" },
  { ...base, reference: ref("2026-07-22"), status: "REFUSEE", assigned_to: COMMERCIALS.lea, motif_refus: "ANNULATION", prospect_nom: "Marchand", prospect_prenom: "Bruno", prospect_telephone: "0612340009" },
  { ...base, reference: ref("2026-07-23"), status: "REFUSEE", assigned_to: COMMERCIALS.hugo, motif_refus: "REFUS_CLASSIQUE", prospect_nom: "Renard", prospect_prenom: "Sabine", prospect_telephone: "0612340010" },
];

const { data, error } = await supabase.from("fiches").insert(rows).select("reference,status,assigned_to,rdv_date,motif_refus");
if (error) {
  console.error("ERROR:", error.message, error.details, error.hint);
  process.exit(1);
}
console.log(`Inserted ${data.length} fiches:`);
for (const f of data) console.log(f.reference, "|", f.status, "|", f.assigned_to, "|", f.rdv_date, "|", f.motif_refus);
