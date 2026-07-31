import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Exclut les assets statiques ET /api/cron/* : cette route gère sa propre
    // authentification via un header `Authorization: Bearer CRON_SECRET`
    // (voir src/app/api/cron/relances/route.ts) et est appelée par Vercel Cron
    // sans session utilisateur — elle ne doit donc pas être redirigée vers
    // /login par ce middleware. Les autres routes /api/* restent protégées
    // ici (elles ne font pas toutes leur propre vérification de session,
    // ex. /api/push/subscribe, /api/push/send).
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
