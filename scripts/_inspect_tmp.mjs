import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: orgs, error: orgErr } = await supabase.from("organizations").select("id,name,slug,company_id");
console.log("ORGS:", JSON.stringify(orgs, null, 2), orgErr);

const { data: profiles, error: profErr } = await supabase.from("profiles").select("id,organization_id,email,first_name,last_name,role,is_active,chef_equipe_id").order("role");
console.log("PROFILES:", JSON.stringify(profiles, null, 2), profErr);

const { data: branches, error: brErr } = await supabase.from("branches").select("*").limit(20);
console.log("BRANCHES:", JSON.stringify(branches, null, 2), brErr);

const { data: recentFiches, error: fErr } = await supabase.from("fiches").select("id,reference,status,rdv_date,assigned_to,organization_id,prospect_nom").order("created_at", { ascending: false }).limit(10);
console.log("RECENT FICHES:", JSON.stringify(recentFiches, null, 2), fErr);
