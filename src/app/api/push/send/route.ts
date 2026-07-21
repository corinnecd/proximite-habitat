import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// IMPORTANT: ne pas appeler webpush.setVapidDetails() au niveau module.
// Next.js exécute ce module pendant "Collecting page data" au build (sans les
// variables d'env runtime forcément présentes) : un appel top-level ferait
// planter le build si VAPID_SUBJECT/VAPID_PRIVATE_KEY ne sont pas définies à
// ce moment-là. On initialise donc à la demande, au premier appel de route.
let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "Configuration VAPID manquante (VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)"
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export async function POST(req: NextRequest) {
  try {
    ensureVapidConfigured();

    const { userIds, title, body, url } = await req.json();
    if (!userIds?.length || !title) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys_auth, keys_p256dh")
      .in("user_id", userIds);

    if (!subs?.length) return NextResponse.json({ sent: 0 });

    const payload = JSON.stringify({ title, body: body ?? "", url: url ?? "/notifications", tag: "ph-notif" });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.keys_auth, p256dh: sub.keys_p256dh } },
          payload
        )
      )
    );

    // Nettoyer les subscriptions expirées (410 Gone)
    const expired = subs.filter((_, i) => {
      const r = results[i];
      return r.status === "rejected" && (r.reason as { statusCode?: number })?.statusCode === 410;
    });
    if (expired.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expired.map((s) => s.endpoint));
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ sent });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
