import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const NEW_PASSWORD = process.argv[2];
if (!NEW_PASSWORD) {
  console.error("Usage: node scripts/_reset_dg_pwd.mjs <new_password>");
  process.exit(1);
}
const { error } = await supabase.auth.admin.updateUserById(
  "c3cc784f-2a15-48cf-b6ab-39c0a85960c7",
  { password: NEW_PASSWORD }
);
console.log(error ? error : "OK - password reset for direction.generale@proximite-habitat.fr");
