/**
 * Helpers côté client pour déclencher les emails transactionnels
 * via l'API route /api/email.
 * Les emails et noms sont résolus côté serveur à partir du ficheId.
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

/** Notifie les admins qu'une fiche a été soumise pour validation. */
export async function sendEmailFicheSoumise(ficheId: string) {
  await postEmail({ type: "FICHE_SOUMISE", ficheId });
}

/** Notifie le commercial affecté qu'une fiche lui a été assignée. */
export async function sendEmailFicheAffectee(ficheId: string) {
  await postEmail({ type: "FICHE_AFFECTEE", ficheId });
}

/** Notifie le prospecteur que la direction a renvoyé sa fiche en brouillon. */
export async function sendEmailFicheRejetee(ficheId: string, motif?: string) {
  await postEmail({ type: "FICHE_REJETEE", ficheId, motif });
}

/** Notifie le prospecteur que sa fiche a été acceptée ou refusée par le commercial. */
export async function sendEmailFicheDecision(ficheId: string, decision: "ACCEPTEE" | "REFUSEE", motif?: string) {
  await postEmail({ type: "FICHE_DECISION", ficheId, decision, motif });
}
