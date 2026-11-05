// Server-only Web Push delivery. VAPID keys are derived from the VAPID_SEED secret.
import { p256 } from "@noble/curves/nist.js";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cached: { publicKey: string; privateKey: string } | null = null;
export async function vapidKeys() {
  if (cached) return cached;
  const seed = process.env["VAPID_SEED"];
  if (!seed) throw new Error("server misconfigured");
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`vapid:${seed}`)));
  const pub = p256.getPublicKey(d, false);
  cached = { publicKey: b64url(pub), privateKey: b64url(d) };
  return cached;
}

type Db = SupabaseClient<Database>;
export type PushItem = { user_id: string; title: string; body: string; url: string };

export async function deliver(db: Db, items: PushItem[]) {
  if (!items.length) return 0;
  const keys = await vapidKeys();
  const userIds = [...new Set(items.map((i) => i.user_id))];
  const { data: subs } = await db.from("push_subscriptions").select("endpoint,p256dh,auth,user_id").in("user_id", userIds);
  let sent = 0;
  const stale: string[] = [];
  await Promise.all(items.flatMap((item) => (subs ?? []).filter((s) => s.user_id === item.user_id).map(async (s) => {
    try {
      const payload = await buildPushPayload(
        { data: { title: item.title, body: item.body, url: item.url }, options: { ttl: 86400, urgency: "high" } },
        { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
        { subject: "mailto:avinatan50@gmail.com", publicKey: keys.publicKey, privateKey: keys.privateKey },
      );
      const res = await fetch(s.endpoint, { method: payload.method, headers: payload.headers, body: payload.body });
      if (res.status === 404 || res.status === 410) stale.push(s.endpoint);
      else if (res.ok) sent++;
      else console.error(`push failed [${res.status}]: ${await res.text()}`);
    } catch (e) { console.error("push error", e); }
  })));
  if (stale.length) await db.from("push_subscriptions").delete().in("endpoint", stale);
  return sent;
}

export async function flushOutbox(db: Db) {
  const { data, error } = await db.rpc("claim_push_outbox", { _limit: 100 });
  if (error) { console.error("claim outbox", error); return 0; }
  return deliver(db, (data ?? []) as PushItem[]);
}
