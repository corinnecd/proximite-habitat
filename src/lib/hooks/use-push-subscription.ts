"use client";
import { useState, useEffect, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output as BufferSource;
}

export type PushStatus = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

export function usePushSubscription(userId: string | null) {
  const [status, setStatus] = useState<PushStatus>("loading");

  const checkStatus = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported"); return;
    }
    const perm = Notification.permission;
    if (perm === "denied") { setStatus("denied"); return; }

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    setStatus(existing ? "subscribed" : "unsubscribed");
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const subscribe = useCallback(async () => {
    if (!userId) return;
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus("denied"); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), userId }),
      });

      setStatus("subscribed");
    } catch {
      setStatus("unsubscribed");
    }
  }, [userId]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return;
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, endpoint: sub.endpoint }),
        });
      }
      setStatus("unsubscribed");
    } catch {
      setStatus("unsubscribed");
    }
  }, [userId]);

  return { status, subscribe, unsubscribe };
}
