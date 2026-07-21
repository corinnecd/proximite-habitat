import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
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
