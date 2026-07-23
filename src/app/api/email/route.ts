import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const FROM_EMAIL = process.env.EMAIL_FROM ?? "Proximité Habitat <noreply@proximite-habitat.fr>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ── Templates ─────────────────────────────────────────────────────────────────

function templateFicheSoumise(reference: string, ficheId: string, referentNom: string) {
  const url = `${APP_URL}/fiches/${ficheId}`;
  return {
    subject: `[Proximité Habitat] Nouvelle fiche à valider — ${reference}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1E3A5F">
        <div style="background:#1E3A5F;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px">Proximité Habitat Conseil</h1>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="color:#1E3A5F;margin-top:0">Nouvelle fiche à valider</h2>
          <p>Bonjour,</p>
          <p>Une nouvelle fiche de pré-visite (<strong>${reference}</strong>) vient d'être soumise par <strong>${referentNom}</strong> et attend votre validation.</p>
          <div style="margin:24px 0">
            <a href="${url}" style="background:#F97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Voir la fiche →
            </a>
          </div>
          <p style="color:#6b7280;font-size:14px">Vous pouvez consulter et valider cette fiche directement depuis votre espace direction.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px">Proximité Habitat Conseil · Ce message est envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>`,
  };
}

function templateFicheAffectee(reference: string, ficheId: string, commercialPrenom: string) {
  const url = `${APP_URL}/fiches/${ficheId}`;
  return {
    subject: `[Proximité Habitat] Fiche affectée — ${reference}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1E3A5F">
        <div style="background:#1E3A5F;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px">Proximité Habitat Conseil</h1>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="color:#1E3A5F;margin-top:0">Une fiche vous a été affectée</h2>
          <p>Bonjour ${commercialPrenom},</p>
          <p>La fiche de pré-visite <strong>${reference}</strong> vous a été affectée par la direction. Veuillez la prendre en charge dès que possible.</p>
          <div style="margin:24px 0">
            <a href="${url}" style="background:#F97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Accéder à la fiche →
            </a>
          </div>
          <p style="color:#6b7280;font-size:14px">Connectez-vous à votre espace commercial pour accepter ou refuser cette fiche.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px">Proximité Habitat Conseil · Ce message est envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>`,
  };
}

function templateFicheDecision(
  reference: string,
  ficheId: string,
  referentPrenom: string,
  decision: "ACCEPTEE" | "REFUSEE",
  motif?: string,
) {
  const url = `${APP_URL}/fiches/${ficheId}`;
  const accepted = decision === "ACCEPTEE";
  return {
    subject: accepted
      ? `[Proximité Habitat] Votre fiche a été acceptée — ${reference}`
      : `[Proximité Habitat] Votre fiche a été refusée — ${reference}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1E3A5F">
        <div style="background:#1E3A5F;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px">Proximité Habitat Conseil</h1>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="color:${accepted ? "#10B981" : "#EF4444"};margin-top:0">
            ${accepted ? "✅ Votre fiche a été acceptée" : "❌ Votre fiche a été refusée"}
          </h2>
          <p>Bonjour ${referentPrenom},</p>
          <p>Votre fiche de pré-visite <strong>${reference}</strong> a été ${accepted ? "acceptée" : "refusée"} par la direction.</p>
          ${!accepted && motif ? `
          <div style="background:#fef2f2;border-left:4px solid #EF4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0">
            <p style="margin:0;font-size:14px;color:#991b1b"><strong>Motif :</strong> ${motif}</p>
          </div>` : ""}
          <div style="margin:24px 0">
            <a href="${url}" style="background:${accepted ? "#10B981" : "#F97316"};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Voir la fiche →
            </a>
          </div>
          ${accepted
            ? `<p style="color:#6b7280;font-size:14px">Félicitations ! Un commercial va prendre contact avec le prospect prochainement.</p>`
            : `<p style="color:#6b7280;font-size:14px">Si vous avez des questions, n'hésitez pas à contacter votre responsable.</p>`
          }
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px">Proximité Habitat Conseil · Ce message est envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>`,
  };
}

function templateFicheRejetee(reference: string, ficheId: string, referentPrenom: string, motif?: string) {
  const url = `${APP_URL}/fiches/${ficheId}`;
  return {
    subject: `[Proximité Habitat] Votre fiche a été renvoyée en brouillon — ${reference}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1E3A5F">
        <div style="background:#1E3A5F;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px">Proximité Habitat Conseil</h1>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="color:#F97316;margin-top:0">⚠️ Fiche renvoyée en brouillon</h2>
          <p>Bonjour ${referentPrenom},</p>
          <p>Votre fiche de pré-visite <strong>${reference}</strong> a été renvoyée en brouillon par la direction. Elle nécessite des corrections avant de pouvoir être soumise à nouveau.</p>
          ${motif ? `
          <div style="background:#fff7ed;border-left:4px solid #F97316;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0">
            <p style="margin:0;font-size:14px;color:#9a3412"><strong>Motif :</strong> ${motif}</p>
          </div>` : ""}
          <div style="margin:24px 0">
            <a href="${url}" style="background:#F97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Corriger la fiche →
            </a>
          </div>
          <p style="color:#6b7280;font-size:14px">Apportez les corrections demandées puis soumettez à nouveau votre fiche depuis votre espace.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px">Proximité Habitat Conseil · Ce message est envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>`,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select("role, organization_id").eq("id", user.id).single();
  if (!caller?.organization_id) {
    return NextResponse.json({ error: "Organisation introuvable" }, { status: 403 });
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY manquant — email non envoyé");
    return NextResponse.json({ skipped: true });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const body = await request.json() as {
    type: "FICHE_SOUMISE" | "FICHE_AFFECTEE" | "FICHE_DECISION" | "FICHE_REJETEE";
    ficheId: string;
    decision?: "ACCEPTEE" | "REFUSEE";
    motif?: string;
  };

  // PROSPECTEUR autorisé uniquement pour FICHE_SOUMISE (soumettre sa propre fiche)
  // ADMIN et COMMERCIAL autorisés pour tous les types
  if (!["DIRECTION", "SUPER_ADMIN", "COMMERCIAL"].includes(caller.role) && body.type !== "FICHE_SOUMISE") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { type, ficheId, motif } = body;

  // ── Résolution sécurisée : charger la fiche et vérifier l'organisation ──
  const { data: fiche } = await supabase
    .from("fiches")
    .select("id, reference, organization_id, created_by, assigned_to")
    .eq("id", ficheId)
    .single();

  if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
  if (fiche.organization_id !== caller.organization_id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    if (type === "FICHE_SOUMISE") {
      // Résoudre les admins et le referent depuis la DB
      const [{ data: admins }, { data: referent }] = await Promise.all([
        supabase.from("profiles").select("email").eq("organization_id", fiche.organization_id).eq("role", "DIRECTION").eq("is_active", true),
        supabase.from("profiles").select("first_name, last_name").eq("id", fiche.created_by).single(),
      ]);
      const adminEmails = (admins ?? []).map((a) => a.email).filter(Boolean) as string[];
      if (adminEmails.length === 0) return NextResponse.json({ sent: 0 });

      const referentNom = referent ? `${referent.first_name} ${referent.last_name}` : "un referent";
      const tpl = templateFicheSoumise(fiche.reference, ficheId, referentNom);
      await resend.emails.send({ from: FROM_EMAIL, to: adminEmails, subject: tpl.subject, html: tpl.html });
      return NextResponse.json({ sent: adminEmails.length });
    }

    if (type === "FICHE_AFFECTEE") {
      if (!fiche.assigned_to) return NextResponse.json({ sent: 0 });
      const { data: commercial } = await supabase.from("profiles").select("email, first_name").eq("id", fiche.assigned_to).single();
      if (!commercial?.email) return NextResponse.json({ sent: 0 });

      const tpl = templateFicheAffectee(fiche.reference, ficheId, commercial.first_name ?? "Commercial");
      await resend.emails.send({ from: FROM_EMAIL, to: commercial.email, subject: tpl.subject, html: tpl.html });
      return NextResponse.json({ sent: 1 });
    }

    if (type === "FICHE_DECISION") {
      const { decision } = body;
      if (!decision) return NextResponse.json({ sent: 0 });
      const { data: referent } = await supabase.from("profiles").select("email, first_name").eq("id", fiche.created_by).single();
      if (!referent?.email) return NextResponse.json({ sent: 0 });

      const tpl = templateFicheDecision(fiche.reference, ficheId, referent.first_name ?? "Référent", decision, motif);
      await resend.emails.send({ from: FROM_EMAIL, to: referent.email, subject: tpl.subject, html: tpl.html });
      return NextResponse.json({ sent: 1 });
    }

    if (type === "FICHE_REJETEE") {
      const { data: referent } = await supabase.from("profiles").select("email, first_name").eq("id", fiche.created_by).single();
      if (!referent?.email) return NextResponse.json({ sent: 0 });

      const tpl = templateFicheRejetee(fiche.reference, ficheId, referent.first_name ?? "Référent", motif);
      await resend.emails.send({ from: FROM_EMAIL, to: referent.email, subject: tpl.subject, html: tpl.html });
      return NextResponse.json({ sent: 1 });
    }

    return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
  } catch (err) {
    console.error("[email] Erreur envoi:", err);
    return NextResponse.json({ error: "Échec envoi email" }, { status: 500 });
  }
}
