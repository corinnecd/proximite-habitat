import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: orgs } = await supabase.from("organizations").select("id,name,slug");
console.log("--ORGS--");
for (const o of orgs) console.log(o.id, "|", o.name, "|", o.slug);

const { data: profiles } = await supabase.from("profiles").select("id,organization_id,email,first_name,last_name,role,is_active");
console.log("--PROFILES (COMMERCIAL/ADMIN)--");
for (const p of profiles) {
  if (p.role === "COMMERCIAL" || p.role === "ADMIN") {
    console.log(p.id, "|", p.organization_id, "|", p.role, "|", p.first_name, p.last_name, "|", p.email, "|active:", p.is_active);
  }
}

const { data: rdvFiches } = await supabase.from("fiches").select("id,reference,status,rdv_date,assigned_to,organization_id").not("rdv_date", "is", null).order("rdv_date", { ascending: false }).limit(15);
console.log("--FICHES WITH RDV_DATE--");
for (const f of rdvFiches) console.log(f.reference, "|", f.status, "|", f.rdv_date, "|", f.assigned_to, "|", f.organization_id);

const { count } = await supabase.from("fiches").select("id", { count: "exact", head: true });
console.log("--TOTAL FICHES COUNT--", count);
