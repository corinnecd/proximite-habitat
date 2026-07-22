import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: profiles, error } = await supabase.from("profiles").select("id,email,first_name,last_name,role,organization_id").eq("role","DIRECTION_GENERALE");
console.log(error, profiles);
