#!/usr/bin/env node
/**
 * Charge tous les départements métropolitains (01–95 + 2A/2B)
 * et TOUTES leurs communes depuis geo.api.gouv.fr → Supabase.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates",
};

async function sbPost(table, rows, onConflict) {
  const h = { ...headers };
  if (onConflict) h.Prefer = "resolution=merge-duplicates";
  const url = onConflict
    ? `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`
    : `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: h,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${table} insert failed (${res.status}): ${txt}`);
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch ${url} → ${res.status}`);
  return res.json();
}

async function main() {
  console.log("1/3 — Chargement des départements depuis geo.api.gouv.fr...");
  const depts = await fetchJSON(
    "https://geo.api.gouv.fr/departements?fields=code,nom,codeRegion"
  );

  // Régions métropolitaines : codeRegion < 10 (hors Corse = 94) + Corse
  // Plus simple : exclure les DOM (codes 97x) → garder code < "97" ou codes 2A/2B
  const metroRegions = await fetchJSON("https://geo.api.gouv.fr/regions");
  const metroRegionCodes = new Set(
    metroRegions
      .filter((r) => !["01", "02", "03", "04", "06"].includes(r.code)) // DOM codes
      .map((r) => r.code)
  );

  const metroDepts = depts
    .filter((d) => metroRegionCodes.has(d.codeRegion))
    .sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }));

  console.log(`   ${metroDepts.length} départements métropolitains trouvés.`);

  // Map codeRegion → nom région
  const regionMap = Object.fromEntries(metroRegions.map((r) => [r.code, r.nom]));

  // Insert départements
  const deptRows = metroDepts.map((d) => ({
    code: d.code,
    nom: d.nom,
    region: regionMap[d.codeRegion] || "Métropole",
  }));

  console.log("2/3 — Insertion des départements dans Supabase...");
  await sbPost("zones_departements", deptRows, "code");
  console.log(`   ✓ ${deptRows.length} départements insérés/mis à jour.`);

  // Insert communes par département
  console.log("3/3 — Chargement et insertion des communes...");
  let totalCommunes = 0;

  for (const dept of metroDepts) {
    const communes = await fetchJSON(
      `https://geo.api.gouv.fr/departements/${dept.code}/communes?fields=nom,codesPostaux,centre&format=json`
    );

    const villeRows = [];
    for (const c of communes) {
      const lat = c.centre?.coordinates?.[1] || 0;
      const lng = c.centre?.coordinates?.[0] || 0;
      for (const cp of c.codesPostaux || []) {
        villeRows.push({
          departement_code: dept.code,
          nom: c.nom,
          code_postal: cp,
          lat,
          lng,
        });
      }
    }

    // Insert par lots de 500
    for (let i = 0; i < villeRows.length; i += 500) {
      const batch = villeRows.slice(i, i + 500);
      await sbPost("zones_villes", batch, "departement_code,nom,code_postal");
    }

    totalCommunes += villeRows.length;
    process.stdout.write(
      `   ${dept.code} ${dept.nom}: ${villeRows.length} entrées | Total: ${totalCommunes}\r`
    );
  }

  console.log(`\n\n✅ Terminé : ${deptRows.length} départements, ${totalCommunes} communes.`);
}

main().catch((e) => {
  console.error("❌ Erreur:", e.message);
  process.exit(1);
});
