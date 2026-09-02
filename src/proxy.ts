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
    //
    // manifest.webmanifest et sw.js étaient auparavant redirigés vers /login
    // pour tout visiteur non authentifié : Chrome recevait du HTML à la place
    // du JSON/JS attendu, ce qui invalidait le manifeste PWA (erreur de syntaxe)
    // et faisait échouer silencieusement `navigator.serviceWorker.register()`
    // avant la première connexion — l'app ne pouvait jamais devenir installable.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|robots.txt|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
