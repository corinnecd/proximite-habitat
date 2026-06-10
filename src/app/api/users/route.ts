import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select("role, organization_id").eq("id", user.id).single();
  if (!caller || caller.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { email, password, first_name, last_name, role, phone, organization_id } = await request.json();
  if (organization_id !== caller.organization_id) return NextResponse.json({ error: "Organisation invalide" }, { status: 403 });

  const svc = await createServiceClient();
  const { data: authUser, error: authError } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError || !authUser.user) return NextResponse.json({ error: authError?.message || "Erreur" }, { status: 400 });

  const { data: profile, error: profileError } = await svc.from("profiles").insert({ id: authUser.user.id, organization_id, email, first_name, last_name, role, phone: phone || null }).select().single();
  if (profileError) { await svc.auth.admin.deleteUser(authUser.user.id); return NextResponse.json({ error: "Erreur profil" }, { status: 500 }); }

  return NextResponse.json(profile);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select("role, organization_id").eq("id", user.id).single();
  if (!caller || caller.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const svc = await createServiceClient();
  const { id, first_name, last_name, phone, role } = await request.json();
  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  if (id === user.id) return NextResponse.json({ error: "Vous ne pouvez pas modifier votre propre compte" }, { status: 403 });

  // Vérifier que l'utilisateur cible appartient à la même organisation (via service client pour éviter la dépendance à la RLS profiles)
  const { data: target } = await svc.from("profiles").select("organization_id").eq("id", id).single();
  if (!target || target.organization_id !== caller.organization_id) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { data: updated, error } = await svc.from("profiles")
    .update({ first_name, last_name, phone: phone || null, role })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}
