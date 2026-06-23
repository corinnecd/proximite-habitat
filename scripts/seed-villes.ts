/**
 * Script pour peupler zones_villes avec TOUTES les communes des départements
 * Île-de-France (75,77,78,91,92,93,94,95) + Oise (60)
 * Source : API officielle geo.api.gouv.fr (gratuite, sans clé)
 *
 * Usage : npx tsx scripts/seed-villes.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DEPARTEMENTS = ["75", "77", "78", "91", "92", "93", "94", "95", "60"];

interface CommuneAPI {
  nom: string;
  code: string;
  codesPostaux: string[];
  centre?: { type: string; coordinates: [number, number] };
  population?: number;
}

async function fetchCommunes(dept: string): Promise<CommuneAPI[]> {
  const url = `https://geo.api.gouv.fr/departements/${dept}/communes?fields=nom,code,codesPostaux,centre,population`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur API pour le département ${dept}: ${res.status}`);
  return res.json();
}

async function main() {
  console.log("Récupération des communes depuis geo.api.gouv.fr...\n");

  let totalInserted = 0;

  for (const dept of DEPARTEMENTS) {
    const communes = await fetchCommunes(dept);
    console.log(`${dept} : ${communes.length} communes trouvées`);

    const rows = communes.flatMap((c) => {
      const lat = c.centre?.coordinates[1] ?? 0;
      const lng = c.centre?.coordinates[0] ?? 0;
      return c.codesPostaux.map((cp) => ({
        departement_code: dept,
        nom: c.nom,
        code_postal: cp,
        lat,
        lng,
      }));
    });

    // Insérer par lots de 500
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("zones_villes")
        .upsert(batch, { onConflict: "departement_code,nom,code_postal" });

      if (error) {
        console.error(`  Erreur batch ${dept} [${i}-${i + batch.length}]:`, error.message);
      } else {
        totalInserted += batch.length;
      }
    }

    console.log(`  → ${rows.length} entrées insérées/mises à jour`);
  }

  console.log(`\nTerminé ! ${totalInserted} villes au total.`);
}

main().catch(console.error);
