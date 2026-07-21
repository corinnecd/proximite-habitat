self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: "Notification", body: event.data.text() }; }

  const title = payload.title ?? "Proximité Habitat";
  const options = {
    body: payload.body ?? "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.tag ?? "ph-notif",
    data: { url: payload.url ?? "/" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
