// Corrections issues de l'audit données :
//  1. Rattacher les fiches sans ville_id à zones_villes (via prospect_ville)
//  2. Renseigner motif_refus manquant sur fiches REFUSEE / RETRACTATION
//  3. Créer notifications + planifications cohérentes pour Succursale_1
//
// Lecture/écriture via service role. Idempotent autant que possible.
// Lancer avec : node --env-file=.env.local scripts/fix-data-audit.mjs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Variables manquantes. Lancer : node --env-file=.env.local scripts/fix-data-audit.mjs");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const ORG_SUCC1 = "a55c6a66-c659-48d6-83db-be22fa7a7bbe";

// ─────────────────────────────────────────────────────────────────────────
// 1. ville_id manquant
// ─────────────────────────────────────────────────────────────────────────
async function fixVilleIds() {
  const { data: fiches } = await sb
    .from("fiches")
    .select("id, organization_id, prospect_ville")
    .is("ville_id", null);

  if (!fiches?.length) { console.log("✓ Aucune fiche sans ville_id."); return; }

  // Ville par défaut si prospect_ville vide, selon l'org HDF ou non
  const ORG_HDF = "ed245e87-69b8-4203-bd9c-6f40479254f3";
  const cache = new Map();

  async function resolveVille(nom) {
    if (cache.has(nom)) return cache.get(nom);
    // 1) match exact
    let { data } = await sb.from("zones_villes")
      .select("id, nom, code_postal").eq("nom", nom).order("code_postal").limit(1);
    // 2) sinon préfixe (ex. "Paris" -> "Paris 1er", "Lyon" -> "Lyon 1er")
    if (!data?.length) {
      ({ data } = await sb.from("zones_villes")
        .select("id, nom, code_postal").ilike("nom", `${nom}%`).order("code_postal").limit(1));
    }
    const res = data?.[0] ?? null;
    cache.set(nom, res);
    return res;
  }

  let fixed = 0, skipped = 0;
  for (const f of fiches) {
    let ville = (f.prospect_ville || "").trim();
    if (!ville) ville = f.organization_id === ORG_HDF ? "Lille" : "Paris";
    const z = await resolveVille(ville);
    if (!z) { console.warn(`  ⚠ ville introuvable: "${ville}" (fiche ${f.id})`); skipped++; continue; }
    const patch = { ville_id: z.id };
    if (!(f.prospect_ville || "").trim()) patch.prospect_ville = z.nom;
    const { error } = await sb.from("fiches").update(patch).eq("id", f.id);
    if (error) { console.warn(`  ⚠ update échoué fiche ${f.id}:`, error.message); skipped++; }
    else fixed++;
  }
  console.log(`✓ ville_id renseigné: ${fixed} fiche(s), ${skipped} ignorée(s).`);
}

// ─────────────────────────────────────────────────────────────────────────
// 2. motif_refus manquant
// ─────────────────────────────────────────────────────────────────────────
async function fixMotifs() {
  const { data: fiches } = await sb
    .from("fiches")
    .select("id, status, motif_refus")
    .in("status", ["REFUSEE", "RETRACTATION"])
    .is("motif_refus", null);

  if (!fiches?.length) { console.log("✓ Aucun motif manquant."); return; }

  // REFUSEE : alterne REFUS_CLASSIQUE / RDC. RETRACTATION : ANNULATION (rétractation client).
  const refuseMotifs = ["REFUS_CLASSIQUE", "RDC"];
  let ri = 0, fixed = 0;
  for (const f of fiches) {
    const motif = f.status === "RETRACTATION" ? "ANNULATION" : refuseMotifs[ri++ % refuseMotifs.length];
    const { error } = await sb.from("fiches").update({ motif_refus: motif }).eq("id", f.id);
    if (error) console.warn(`  ⚠ motif fiche ${f.id}:`, error.message);
    else fixed++;
  }
  console.log(`✓ motif_refus renseigné: ${fixed} fiche(s).`);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Succursale_1 : planifications + notifications
// ─────────────────────────────────────────────────────────────────────────
function mondayOf(d) {
  const x = new Date(d);
  const dow = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - dow);
  return x;
}
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function seedSucc1Planifs() {
  const { count } = await sb.from("planification_hebdo")
    .select("*", { count: "exact", head: true }).eq("organization_id", ORG_SUCC1);
  if (count && count > 0) { console.log(`✓ Succursale_1 a déjà ${count} planification(s).`); return; }

  // Un référent créateur + des villes de la succursale (depuis ses fiches)
  const { data: refs } = await sb.from("profiles")
    .select("id").eq("organization_id", ORG_SUCC1).eq("role", "PROSPECTEUR").limit(1);
  const createdBy = refs?.[0]?.id;
  if (!createdBy) { console.warn("  ⚠ aucun référent Succursale_1, planifs ignorées."); return; }

  const { data: villeRows } = await sb.from("fiches")
    .select("ville_id").eq("organization_id", ORG_SUCC1).not("ville_id", "is", null);
  const villeIds = [...new Set((villeRows ?? []).map((r) => r.ville_id))];
  if (!villeIds.length) { console.warn("  ⚠ aucune ville Succursale_1, planifs ignorées."); return; }

  // 3 semaines : courante, -1, -2
  const today = new Date("2026-06-26T12:00:00Z");
  const weeks = [0, 1, 2].map((w) => {
    const m = mondayOf(today); m.setDate(m.getDate() - 7 * w); return ymd(m);
  });

  const rows = [];
  let vi = 0;
  for (const semaine of weeks) {
    // 3 villes planifiées par semaine
    for (let k = 0; k < 3 && vi < villeIds.length * 3; k++) {
      rows.push({
        organization_id: ORG_SUCC1,
        semaine_du: semaine,
        ville_id: villeIds[vi++ % villeIds.length],
        created_by: createdBy,
      });
    }
  }
  const { error, count: ins } = await sb.from("planification_hebdo").insert(rows).select("*", { count: "exact", head: true });
  if (error) console.warn("  ⚠ planifs Succursale_1:", error.message);
  else console.log(`✓ Succursale_1 : ${ins ?? rows.length} planification(s) créée(s).`);
}

async function seedSucc1Notifs() {
  const { count } = await sb.from("notifications")
    .select("*", { count: "exact", head: true }).eq("organization_id", ORG_SUCC1);
  if (count && count > 0) { console.log(`✓ Succursale_1 a déjà ${count} notification(s).`); return; }

  const { data: admins } = await sb.from("profiles")
    .select("id").eq("organization_id", ORG_SUCC1).eq("role", "ADMIN");
  const adminIds = (admins ?? []).map((a) => a.id);

  // Notifs basées sur les fiches existantes de la succursale
  const { data: fiches } = await sb.from("fiches")
    .select("id, reference, status, created_by, assigned_to, prospect_nom, prospect_prenom")
    .eq("organization_id", ORG_SUCC1)
    .in("status", ["SOUMISE", "AFFECTEE", "ACCEPTEE", "REFUSEE", "RETRACTATION"]);

  if (!fiches?.length) { console.warn("  ⚠ aucune fiche Succursale_1, notifs ignorées."); return; }

  const notifs = [];
  const push = (user_id, type, title, message, fiche_id) => {
    if (user_id) notifs.push({ user_id, organization_id: ORG_SUCC1, type, title, message, fiche_id, read: false });
  };

  for (const f of fiches) {
    const who = `${f.prospect_prenom ?? ""} ${f.prospect_nom ?? ""}`.trim() || "le prospect";
    if (f.status === "SOUMISE") {
      // notifier les admins (à valider)
      for (const a of adminIds) push(a, "FICHE_SOUMISE", "Nouvelle fiche à valider", `Fiche ${f.reference} (${who}) soumise — en attente de validation.`, f.id);
    } else if (f.status === "AFFECTEE") {
      push(f.assigned_to, "FICHE_AFFECTEE", "Fiche affectée", `La fiche ${f.reference} (${who}) vous a été affectée.`, f.id);
    } else if (f.status === "ACCEPTEE") {
      push(f.created_by, "FICHE_ACCEPTEE", "Fiche acceptée", `La fiche ${f.reference} (${who}) a été acceptée par le client.`, f.id);
    } else if (f.status === "REFUSEE") {
      push(f.created_by, "FICHE_REFUSEE", "Fiche refusée", `La fiche ${f.reference} (${who}) a été refusée.`, f.id);
    } else if (f.status === "RETRACTATION") {
      push(f.created_by, "FICHE_RETRACTATION", "Rétractation client", `Le client de la fiche ${f.reference} (${who}) s'est rétracté.`, f.id);
    }
  }

  if (!notifs.length) { console.warn("  ⚠ aucune notif générée."); return; }
  const { error } = await sb.from("notifications").insert(notifs);
  if (error) console.warn("  ⚠ notifs Succursale_1:", error.message);
  else console.log(`✓ Succursale_1 : ${notifs.length} notification(s) créée(s).`);
}

// ─────────────────────────────────────────────────────────────────────────
(async () => {
  console.log("→ 1/3 ville_id…");      await fixVilleIds();
  console.log("→ 2/3 motif_refus…");   await fixMotifs();
  console.log("→ 3/3 Succursale_1…");  await seedSucc1Planifs(); await seedSucc1Notifs();
  console.log("Terminé.");
})();
