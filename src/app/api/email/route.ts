import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const FROM_EMAIL = process.env.EMAIL_FROM ?? "Proximité Habitat <noreply@proximite-habitat.fr>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ── Templates ─────────────────────────────────────────────────────────────────

function templateFicheSoumise(reference: string, ficheId: string, prospecteurNom: string) {
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
          <p>Une nouvelle fiche de pré-visite (<strong>${reference}</strong>) vient d'être soumise par <strong>${prospecteurNom}</strong> et attend votre validation.</p>
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
  prospecteurPrenom: string,
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
          <p>Bonjour ${prospecteurPrenom},</p>
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

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Vérifier que l'appelant est authentifié
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!process.env.RESEND_API_KEY) {
    // Pas de clé configurée : on log mais on ne bloque pas le flux métier
    console.warn("[email] RESEND_API_KEY manquant — email non envoyé");
    return NextResponse.json({ skipped: true });
  }

  // Instanciation lazy : uniquement quand la clé est disponible (runtime, pas build)
  const resend = new Resend(process.env.RESEND_API_KEY);

  const body = await request.json() as {
    type: "FICHE_SOUMISE" | "FICHE_AFFECTEE" | "FICHE_DECISION";
    ficheId: string;
    reference: string;
    prospecteurNom?: string;
    prospecteurPrenom?: string;
    prospecteurEmail?: string;
    commercialPrenom?: string;
    commercialEmail?: string;
    adminEmails?: string[];
    decision?: "ACCEPTEE" | "REFUSEE";
    motif?: string;
  };

  const { type, ficheId, reference } = body;

  try {
    if (type === "FICHE_SOUMISE") {
      const { adminEmails = [], prospecteurNom = "un prospecteur" } = body;
      if (adminEmails.length === 0) return NextResponse.json({ sent: 0 });

      const tpl = templateFicheSoumise(reference, ficheId, prospecteurNom);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: adminEmails,
        subject: tpl.subject,
        html: tpl.html,
      });
      return NextResponse.json({ sent: adminEmails.length });
    }

    if (type === "FICHE_AFFECTEE") {
      const { commercialEmail, commercialPrenom = "Commercial" } = body;
      if (!commercialEmail) return NextResponse.json({ sent: 0 });

      const tpl = templateFicheAffectee(reference, ficheId, commercialPrenom);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: commercialEmail,
        subject: tpl.subject,
        html: tpl.html,
      });
      return NextResponse.json({ sent: 1 });
    }

    if (type === "FICHE_DECISION") {
      const { prospecteurEmail, prospecteurPrenom = "Prospecteur", decision, motif } = body;
      if (!prospecteurEmail || !decision) return NextResponse.json({ sent: 0 });

      const tpl = templateFicheDecision(reference, ficheId, prospecteurPrenom, decision, motif);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: prospecteurEmail,
        subject: tpl.subject,
        html: tpl.html,
      });
      return NextResponse.json({ sent: 1 });
    }

    return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
  } catch (err) {
    console.error("[email] Erreur envoi:", err);
    return NextResponse.json({ error: "Échec envoi email" }, { status: 500 });
  }
}
