import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STALE_DAYS_RDV_A_REPRENDRE = 3;
const STALE_DAYS_AFFECTEE = 7;
const STALE_DAYS_SOUMISE = 5;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let totalNotifs = 0;

  // 1. Fiches RDV_A_REPRENDRE depuis plus de X jours
  const rdvCutoff = new Date(now);
  rdvCutoff.setDate(rdvCutoff.getDate() - STALE_DAYS_RDV_A_REPRENDRE);
  const { data: rdvFiches } = await supabase
    .from("fiches")
    .select("id, reference, prospect_nom, assigned_to, organization_id")
    .eq("status", "RDV_A_REPRENDRE")
    .lt("updated_at", rdvCutoff.toISOString());

  for (const f of rdvFiches ?? []) {
    if (!f.assigned_to) continue;
    await insertNotification(
      f.assigned_to,
      f.organization_id,
      "RELANCE",
      `Relance : ${f.prospect_nom ?? f.reference} — RDV à reprendre depuis ${STALE_DAYS_RDV_A_REPRENDRE} jours`,
      f.id
    );
    totalNotifs++;
  }

  // 2. Fiches AFFECTEE sans action depuis X jours
  const affCutoff = new Date(now);
  affCutoff.setDate(affCutoff.getDate() - STALE_DAYS_AFFECTEE);
  const { data: affFiches } = await supabase
    .from("fiches")
    .select("id, reference, prospect_nom, assigned_to, organization_id")
    .eq("status", "AFFECTEE")
    .lt("updated_at", affCutoff.toISOString());

  for (const f of affFiches ?? []) {
    if (!f.assigned_to) continue;
    await insertNotification(
      f.assigned_to,
      f.organization_id,
      "RELANCE",
      `Relance : ${f.prospect_nom ?? f.reference} — affectée depuis ${STALE_DAYS_AFFECTEE} jours sans action`,
      f.id
    );
    totalNotifs++;
  }

  // 3. Fiches SOUMISE en attente de validation depuis X jours → notifier les admins
  const soumCutoff = new Date(now);
  soumCutoff.setDate(soumCutoff.getDate() - STALE_DAYS_SOUMISE);
  const { data: soumFiches } = await supabase
    .from("fiches")
    .select("id, reference, prospect_nom, organization_id")
    .eq("status", "SOUMISE")
    .lt("updated_at", soumCutoff.toISOString());

  if (soumFiches && soumFiches.length > 0) {
    const orgIds = [...new Set(soumFiches.map((f) => f.organization_id))];
    for (const orgId of orgIds) {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", orgId)
        .in("role", ["DIRECTION", "SUPER_ADMIN", "DIRECTION_GENERALE"])
        .eq("is_active", true);

      const orgFiches = soumFiches.filter((f) => f.organization_id === orgId);
      for (const admin of admins ?? []) {
        await insertNotification(
          admin.id,
          orgId,
          "RELANCE",
          `${orgFiches.length} fiche${orgFiches.length > 1 ? "s" : ""} en attente de validation depuis plus de ${STALE_DAYS_SOUMISE} jours`,
          orgFiches[0].id
        );
        totalNotifs++;
      }
    }
  }

  // 4. Rappels RDV Technicien J-2 / J-1 / JJ
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let rdvTechNotifs = 0;

  for (const offset of [2, 1, 0]) {
    const target = new Date(today);
    target.setDate(today.getDate() + offset);
    const dateStr = target.toISOString().split("T")[0];

    const { data: techFiches } = await supabase
      .from("fiches")
      .select("id, reference, prospect_nom, organization_id, assigned_to, rdv_technicien_heure")
      .eq("status", "RDV_TECHNICIEN")
      .eq("rdv_technicien_date", dateStr)
      .not("assigned_to", "is", null);

    for (const f of techFiches ?? []) {
      const label = offset === 2 ? "dans 2 jours" : offset === 1 ? "demain" : "aujourd'hui";
      const type  = offset === 2 ? "RDV_TECH_J2"  : offset === 1 ? "RDV_TECH_J1"  : "RDV_TECH_JJ";
      const [y, m, d] = dateStr.split("-");
      const dateFr = `${d}/${m}/${y}`;
      const heurePart = f.rdv_technicien_heure
        ? ` à ${f.rdv_technicien_heure.replace(":", "h")}`
        : "";
      const nom = f.prospect_nom ?? f.reference;

      await insertNotification(
        f.assigned_to!,
        f.organization_id,
        type,
        `RDV Technicien ${label} — ${nom} (${dateFr}${heurePart})`,
        f.id
      );
      rdvTechNotifs++;
    }
  }
  totalNotifs += rdvTechNotifs;

  return NextResponse.json({
    ok: true,
    relances: totalNotifs,
    details: {
      rdv_a_reprendre: rdvFiches?.length ?? 0,
      affectees: affFiches?.length ?? 0,
      soumises: soumFiches?.length ?? 0,
      rdv_tech_rappels: rdvTechNotifs,
    },
  });
}

async function insertNotification(
  userId: string,
  orgId: string,
  type: string,
  title: string,
  ficheId: string
) {
  const oneDay = new Date();
  oneDay.setDate(oneDay.getDate() - 1);
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("fiche_id", ficheId)
    .gte("created_at", oneDay.toISOString())
    .limit(1);

  if (existing && existing.length > 0) return;

  await supabase.from("notifications").insert({
    user_id: userId,
    organization_id: orgId,
    type,
    title,
    fiche_id: ficheId,
    read: false,
  });

  // Envoyer le push en arrière-plan
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    await fetch(`${base}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: [userId],
        title,
        body: title,
        url: `/fiches/${ficheId}`,
      }),
    });
  } catch {
    // Push facultatif — la notification in-app est déjà créée
  }
}
