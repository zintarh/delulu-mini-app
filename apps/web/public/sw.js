/* eslint-disable no-restricted-globals */

/**
 * Push + update service worker (no offline HTML/JS caching).
 * Bump SW_VERSION when changing this file so installs always see a byte change.
 */
const SW_VERSION = "delulu-sw-v3-2026-07-27";

self.addEventListener("install", (event) => {
  // Activate immediately so users don't need to kill the PWA after a deploy.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clear any leftover Cache Storage from older SW experiments.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
      // Quiet log so DevTools shows which build is controlling the client.
      console.log(`[sw.js] activated ${SW_VERSION}`);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  try {
    let data = {};
    if (event.data) {
      try {
        data = event.data.json();
      } catch {
        const text = event.data.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }
    }

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
    console.error("[sw.js] push error:", e);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification && event.notification.data && event.notification.data.url) ||
    "/";

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
