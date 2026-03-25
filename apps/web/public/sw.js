/* eslint-disable no-restricted-globals */

// Minimal service worker for Web Push.
// Note: caching/offline strategies can be added later.

self.addEventListener("push", (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "Delulu";
    const body = data.body || "";
    const url = data.url || "/";

    const options = {
      body,
      icon: "/favicon_io/android-chrome-192x192.png",
      badge: "/favicon_io/favicon-32x32.png",
      data: { url },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // Best-effort: ignore malformed push payloads.
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    })(),
  );
});

