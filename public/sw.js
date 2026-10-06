self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("push", (event) => {
  let data = { title: "Карман", body: "Проверь расходы за сегодня" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icon.svg",
        tag: data.tag,
        data: { url: "/events" },
      }),
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) =>
          client.postMessage({
            type: "reminder",
            id: data.id,
            title: data.title,
            body: data.body,
          }),
        );
      }),
    ]),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const client = clients.find(
          (c) => new URL(c.url).origin === self.location.origin,
        );
        if (client) {
          client.navigate("/events");
          return client.focus();
        }
        return self.clients.openWindow("/events");
      }),
  );
});
