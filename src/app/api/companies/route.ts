import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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

async function uniqueSlug(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  table: "companies" | "organizations",
  name: string,
  fallback: string,
): Promise<string> {
  const base = slugify(name) || fallback;
  let slug = base;
  for (let i = 1; ; i++) {
    const { data } = await svc.from(table).select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i}`;
  }
}

/**
 * POST /api/companies — bootstrap d'une nouvelle société :
 *   1. crée la société (companies)
 *   2. crée son siège (organization, is_hq = true)
 *   3. crée le compte DIRECTION_GENERALE rattaché au siège
 *
 * Opération de niveau plateforme : protégée par l'en-tête
 * `x-platform-secret` comparé à la variable d'environnement PLATFORM_ADMIN_SECRET.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.PLATFORM_ADMIN_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Création de société non configurée (PLATFORM_ADMIN_SECRET absent)" },
      { status: 503 },
    );
  }
  if (request.headers.get("x-platform-secret") !== expected) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const {
    company_name,
    hq_name,
    dg_email,
    dg_password,
    dg_first_name,
    dg_last_name,
  } = body as Record<string, string | undefined>;

  if (!company_name || company_name.trim().length === 0)
    return NextResponse.json({ error: "Nom de la société requis" }, { status: 400 });
  if (!dg_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dg_email))
    return NextResponse.json({ error: "Email du DG invalide" }, { status: 400 });
  if (!dg_password || dg_password.length < 8)
    return NextResponse.json({ error: "Mot de passe du DG requis (8 caractères minimum)" }, { status: 400 });
  if (!dg_first_name || dg_first_name.trim().length === 0)
    return NextResponse.json({ error: "Prénom du DG requis" }, { status: 400 });
  if (!dg_last_name || dg_last_name.trim().length === 0)
    return NextResponse.json({ error: "Nom du DG requis" }, { status: 400 });

  const svc = await createServiceClient();

  // 1. Société
  const companySlug = await uniqueSlug(svc, "companies", company_name, "societe");
  const { data: company, error: companyErr } = await svc
    .from("companies")
    .insert({ name: company_name.trim(), slug: companySlug })
    .select()
    .single();
  if (companyErr || !company)
    return NextResponse.json({ error: companyErr?.message ?? "Erreur création société" }, { status: 500 });

  // 2. Siège
  const hqLabel = hq_name?.trim() || "Siège";
  const hqSlug = await uniqueSlug(svc, "organizations", `${company_name}-${hqLabel}`, "siege");
  const { data: hq, error: hqErr } = await svc
    .from("organizations")
    .insert({ name: hqLabel, slug: hqSlug, company_id: company.id, is_hq: true })
    .select()
    .single();
  if (hqErr || !hq) {
    await svc.from("companies").delete().eq("id", company.id);
    return NextResponse.json({ error: hqErr?.message ?? "Erreur création siège" }, { status: 500 });
  }

  // 3. Compte DG
  const { data: authUser, error: authErr } = await svc.auth.admin.createUser({
    email: dg_email.trim().toLowerCase(),
    password: dg_password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) {
    await svc.from("organizations").delete().eq("id", hq.id);
    await svc.from("companies").delete().eq("id", company.id);
    return NextResponse.json({ error: authErr?.message ?? "Erreur création utilisateur DG" }, { status: 400 });
  }

  const { data: dgProfile, error: profileErr } = await svc
    .from("profiles")
    .insert({
      id: authUser.user.id,
      organization_id: hq.id,
      email: dg_email.trim().toLowerCase(),
      first_name: dg_first_name.trim(),
      last_name: dg_last_name.trim(),
      role: "DIRECTION_GENERALE",
    })
    .select()
    .single();
  if (profileErr) {
    await svc.auth.admin.deleteUser(authUser.user.id);
    await svc.from("organizations").delete().eq("id", hq.id);
    await svc.from("companies").delete().eq("id", company.id);
    return NextResponse.json({ error: "Erreur création profil DG" }, { status: 500 });
  }

  return NextResponse.json({ company, hq, dg: dgProfile });
}
