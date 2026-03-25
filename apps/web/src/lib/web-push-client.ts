"use client";

import { env } from "@/lib/env";

export type PushSupportState =
  | { state: "unsupported" }
  | { state: "needs_permission"; permission: NotificationPermission }
  | { state: "ready"; permission: NotificationPermission; subscribed: boolean };

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getPushSupportState(): Promise<PushSupportState> {
  if (typeof window === "undefined") return { state: "unsupported" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { state: "unsupported" };
  }
  if (!("Notification" in window)) return { state: "unsupported" };

  const permission = Notification.permission;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;

  if (permission !== "granted") {
    return { state: "needs_permission", permission };
  }
  return { state: "ready", permission, subscribed: Boolean(sub) };
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  const reg =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  return reg;
}

export async function subscribeToWebPush(address: string): Promise<void> {
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    throw new Error("Push is not configured (missing VAPID public key).");
  }
  const reg = await ensureServiceWorker();

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications permission not granted.");
  }

  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address,
      subscription: {
        endpoint: subscription.endpoint,
        keys: json.keys,
      },
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? "Failed to save push subscription.");
  }
}

export async function unsubscribeWebPush(address: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await sub.unsubscribe().catch(() => {});
  }
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, endpoint: sub?.endpoint ?? null }),
  }).catch(() => {});
}

