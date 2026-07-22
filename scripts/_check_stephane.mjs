import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STEPHANE = "d2375910-4c6f-407d-ab7f-c0e8040209f5";

const { data, error } = await supabase
  .from("fiches")
  .select("id,reference,status,rdv_date,heure_visite,assigned_to,organization_id,prospect_nom,prospect_prenom,updated_at,created_at")
  .eq("assigned_to", STEPHANE)
  .order("created_at", { ascending: false });

if (error) { console.error(error); process.exit(1); }
console.log(`Fiches assignées à Stéphane Lecomte: ${data.length}`);
for (const f of data) {
  console.log(f.reference, "|", f.status, "| rdv_date:", f.rdv_date, "| heure:", f.heure_visite, "|", f.prospect_prenom, f.prospect_nom, "| updated:", f.updated_at);
}
