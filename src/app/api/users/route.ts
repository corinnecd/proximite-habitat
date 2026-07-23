import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select("role, organization_id").eq("id", user.id).single();
  if (!caller || (caller.role !== "SUPER_ADMIN" && caller.role !== "DIRECTION" && caller.role !== "DIRECTION_GENERALE"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const { email, password, first_name, last_name, role, phone, organization_id } = body;

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  if (!password || typeof password !== "string" || password.length < 8)
    return NextResponse.json({ error: "Mot de passe requis (8 caractères minimum)" }, { status: 400 });
  if (!first_name || typeof first_name !== "string" || first_name.trim().length === 0)
    return NextResponse.json({ error: "Prénom requis" }, { status: 400 });
  if (!last_name || typeof last_name !== "string" || last_name.trim().length === 0)
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  const validRoles = ["SUPER_ADMIN", "DIRECTION", "COMMERCIAL", "PROSPECTEUR", "CHEF_EQUIPE", "DIRECTION_GENERALE"];
  if (!role || !validRoles.includes(role))
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });

  // DIRECTION : même organisation uniquement. DG/SUPER_ADMIN : n'importe quelle succursale de sa société.
  if (caller.role === "DIRECTION") {
    if (organization_id !== caller.organization_id)
      return NextResponse.json({ error: "Organisation invalide" }, { status: 403 });
  } else if (caller.role === "DIRECTION_GENERALE") {
    const svcCheck = await createServiceClient();
    const { data: callerOrg } = await svcCheck.from("organizations").select("company_id").eq("id", caller.organization_id).single();
    const { data: targetOrg } = await svcCheck.from("organizations").select("company_id").eq("id", organization_id).single();
    if (!callerOrg || !targetOrg || callerOrg.company_id !== targetOrg.company_id)
      return NextResponse.json({ error: "Organisation hors de votre société" }, { status: 403 });
  }

  const svc = await createServiceClient();
  const { data: authUser, error: authError } = await svc.auth.admin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true });
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
  if (!caller || (caller.role !== "SUPER_ADMIN" && caller.role !== "DIRECTION" && caller.role !== "DIRECTION_GENERALE"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const svc = await createServiceClient();
  const { id, first_name, last_name, phone, role } = await request.json();
  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  if (id === user.id) return NextResponse.json({ error: "Vous ne pouvez pas modifier votre propre compte" }, { status: 403 });

  const { data: target } = await svc.from("profiles").select("organization_id").eq("id", id).single();
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  if (caller.role === "DIRECTION") {
    if (target.organization_id !== caller.organization_id)
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  } else if (caller.role === "DIRECTION_GENERALE") {
    const { data: callerOrg } = await svc.from("organizations").select("company_id").eq("id", caller.organization_id).single();
    const { data: targetOrg } = await svc.from("organizations").select("company_id").eq("id", target.organization_id).single();
    if (!callerOrg || !targetOrg || callerOrg.company_id !== targetOrg.company_id)
      return NextResponse.json({ error: "Utilisateur hors de votre société" }, { status: 403 });
  }

  const { data: updated, error } = await svc.from("profiles")
    .update({ first_name, last_name, phone: phone || null, role })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}
