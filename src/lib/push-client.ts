// Browser-side push registration helpers.
import { supabase } from "@/integrations/supabase/client";
import { getVapidPublicKey } from "@/lib/push.functions";

export type PushState = "unsupported" | "iframe" | "ios-install" | "denied" | "off" | "on";

const SW = "/push-sw.js";
const SCOPE = "/push-scope/";

function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() { return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true; }

function toBytes(b64: string) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export async function pushState(): Promise<PushState> {
  if (window.top !== window.self) return "iframe";
  if (isIos() && !isStandalone()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration(SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  const st = await pushState();
  if (st !== "off" && st !== "on") return st;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register(SW, { scope: SCOPE });
  await navigator.serviceWorker.ready.catch(() => undefined);
  const key = await getVapidPublicKey();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
  const j = sub.toJSON();
  const { error } = await supabase.rpc("register_push", { _endpoint: sub.endpoint, _p256dh: j.keys?.["p256dh"] ?? "", _auth: j.keys?.["auth"] ?? "" });
  if (error) throw error;
  return "on";
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration(SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) { await supabase.rpc("unregister_push", { _endpoint: sub.endpoint }); await sub.unsubscribe(); }
}
