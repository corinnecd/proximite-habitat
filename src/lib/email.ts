/**
 * Helpers côté client pour déclencher les emails transactionnels
 * via l'API route /api/email.
 * Les erreurs sont silencieuses (ne bloquent pas le flux métier).
 */

async function postEmail(body: Record<string, unknown>) {
  try {
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.skipped) console.warn("[email] Email non envoyé — RESEND_API_KEY manquant en production");
  } catch (err) {
    console.warn("[email] Échec non bloquant :", err);
  }
}

/** Envoi d'email aux admins quand une fiche est soumise pour validation. */
export async function sendEmailFicheSoumise(opts: {
  ficheId: string;
  reference: string;
  prospecteurNom: string;
  adminEmails: string[];
}) {
  if (opts.adminEmails.length === 0) return;
  await postEmail({ type: "FICHE_SOUMISE", ...opts });
}

/** Envoi d'email au commercial quand une fiche lui est affectée. */
export async function sendEmailFicheAffectee(opts: {
  ficheId: string;
  reference: string;
  commercialPrenom: string;
  commercialEmail: string;
}) {
  await postEmail({ type: "FICHE_AFFECTEE", ...opts });
}

/** Envoi d'email au prospecteur quand la direction renvoie sa fiche en brouillon. */
export async function sendEmailFicheRejetee(opts: {
  ficheId: string;
  reference: string;
  prospecteurPrenom: string;
  prospecteurEmail: string;
  motif?: string;
}) {
  await postEmail({ type: "FICHE_REJETEE", ...opts });
}

/** Envoi d'email au prospecteur quand sa fiche est acceptée ou refusée. */
export async function sendEmailFicheDecision(opts: {
  ficheId: string;
  reference: string;
  decision: "ACCEPTEE" | "REFUSEE";
  prospecteurPrenom: string;
  prospecteurEmail: string;
  motif?: string;
}) {
  await postEmail({ type: "FICHE_DECISION", ...opts });
}
