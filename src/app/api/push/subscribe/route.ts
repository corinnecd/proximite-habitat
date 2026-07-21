import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId } = await req.json();
    if (!subscription?.endpoint || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        keys_auth: subscription.keys.auth,
        keys_p256dh: subscription.keys.p256dh,
      },
      { onConflict: "user_id,endpoint" }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, endpoint } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const query = supabase.from("push_subscriptions").delete().eq("user_id", userId);
    if (endpoint) query.eq("endpoint", endpoint);
    await query;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
