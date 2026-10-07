const CACHE = "karman-shell-v2";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(["/icon-192.png", "/icon-512.png", "/offline.html"]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("karman-shell-") && k !== CACHE)
              .map((k) => caches.delete(k)),
          ),
        ),
    ]),
  ),
);
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
});
self.addEventListener("push", (event) => {
  let d = { title: "Карман", body: "Новое уведомление", url: "/events" };
  try {
    d = { ...d, ...event.data.json() };
  } catch {}
  const path =
    typeof d.url === "string" && /^\/(events|chats)(\?|$)/.test(d.url)
      ? d.url
      : "/events";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(d.title, {
        body: d.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: d.tag,
        data: { url: path },
        vibrate: [150, 80, 150],
      }),
      self.clients.matchAll({ type: "window" }).then((clients) =>
        clients.forEach((client) =>
          client.postMessage({
            type: d.type || "reminder",
            id: d.id,
            title: d.title,
            body: d.body,
            url: path,
          }),
        ),
      ),
    ]),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/events";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const client = clients.find(
          (c) => new URL(c.url).origin === self.location.origin,
        );
        if (client) {
          await client.navigate(path);
          return client.focus();
        }
        return self.clients.openWindow(path);
      }),
  );
});
