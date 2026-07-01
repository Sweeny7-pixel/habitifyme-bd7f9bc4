/**
 * Browser helpers for Web Push. Never imported from server-only code.
 * Registration and permission requests are safe no-ops in Lovable preview
 * (iframe / preview host) so the editor never subscribes to a phantom
 * endpoint that would then keep receiving cron pushes.
 */
import { VAPID_PUBLIC_KEY } from "./push-vapid-public";

const SW_URL = "/push-sw.js";

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true; // iframe
  } catch {
    return true; // cross-origin frame — treat as preview
  }
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev")
  );
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  const isStandalone =
    "standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone;
  return isIos && !isStandalone;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function getOrRegisterSW(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported() || isPreviewHost()) return null;
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  const reg = await getOrRegisterSW();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export type SubscribeResult =
  | { ok: true; subscription: PushSubscription }
  | { ok: false; reason: "unsupported" | "preview" | "denied" | "ios-standalone" | "error"; error?: unknown };

export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (isPreviewHost()) return { ok: false, reason: "preview" };
  if (isIosSafari()) return { ok: false, reason: "ios-standalone" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const reg = await getOrRegisterSW();
    if (!reg) return { ok: false, reason: "unsupported" };
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    return { ok: true, subscription: sub };
  } catch (error) {
    return { ok: false, reason: "error", error };
  }
}

export async function unsubscribeFromPush(): Promise<PushSubscription | null> {
  const sub = await getExistingPushSubscription();
  if (!sub) return null;
  await sub.unsubscribe();
  return sub;
}

/** Serialize a PushSubscription into the shape our server function accepts. */
export function serializeSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}
