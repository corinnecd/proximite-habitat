import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Génère un slug URL-safe à partir d'un nom. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * POST /api/branches — crée une nouvelle succursale (organization) au sein de
 * la société du DG appelant. Réservé au rôle DIRECTION_GENERALE.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: caller } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  if (!caller || caller.role !== "DIRECTION_GENERALE")
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const { name } = body as { name?: string };
  if (!name || typeof name !== "string" || name.trim().length === 0)
    return NextResponse.json({ error: "Nom de la succursale requis" }, { status: 400 });

  const svc = await createServiceClient();

  // Récupérer la société (company_id) du DG
  const { data: callerOrg } = await svc
    .from("organizations")
    .select("company_id")
    .eq("id", caller.organization_id)
    .single();
  if (!callerOrg?.company_id)
    return NextResponse.json({ error: "Société introuvable pour ce DG" }, { status: 400 });

  // Slug unique
  const base = slugify(name) || "succursale";
  let slug = base;
  for (let i = 1; ; i++) {
    const { data: existing } = await svc.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${base}-${i}`;
  }

  const { data: branch, error } = await svc
    .from("organizations")
    .insert({ name: name.trim(), slug, company_id: callerOrg.company_id, is_hq: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(branch);
}
