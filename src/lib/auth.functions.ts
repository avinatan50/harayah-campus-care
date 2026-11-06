import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { EASY_CODE_MESSAGE, TAKEN_CODE_MESSAGE, isEasyCode } from "@/lib/access-code";

const codeSchema = z.string().regex(/^\d{4}$/, "יש להזין 4 ספרות");

export type SessionTokens = { access_token: string; refresh_token: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

function clientIp(): string {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function hashCode(code: string): Promise<string> {
  const pepper = process.env["CODE_PEPPER"];
  if (!pepper) throw new Error("server misconfigured");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomPassword(): string {
  const bytes = new Uint8Array(36);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const LIMITS: Record<string, { perIp: number; global: number; minutes: number }> = {
  login: { perIp: 5, global: 60, minutes: 15 },
  signup: { perIp: 10, global: 100, minutes: 60 },
  setup: { perIp: 5, global: 20, minutes: 60 },
};

async function isRateLimited(kind: string, ip: string): Promise<boolean> {
  const db = await admin();
  const lim = LIMITS[kind];
  if (!lim) return true;
  const since = new Date(Date.now() - lim.minutes * 60_000).toISOString();
  const [perIp, global] = await Promise.all([
    db.from("login_attempts").select("id", { count: "exact", head: true })
      .eq("kind", kind).eq("ip", ip).eq("success", false).gte("created_at", since),
    db.from("login_attempts").select("id", { count: "exact", head: true })
      .eq("kind", kind).eq("success", false).gte("created_at", since),
  ]);
  return (perIp.count ?? 0) >= lim.perIp || (global.count ?? 0) >= lim.global;
}

async function recordAttempt(kind: string, ip: string, success: boolean) {
  const db = await admin();
  await db.from("login_attempts").insert({ kind, ip, success });
}

/** Rotates the user's internal password and signs in server-side, returning session tokens. */
async function issueSession(userId: string, email: string): Promise<SessionTokens> {
  const db = await admin();
  const password = randomPassword();
  const { error: upErr } = await db.auth.admin.updateUserById(userId, { password });
  if (upErr) throw new Error("session error");
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error("session error");
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

const RATE_MSG = "יותר מדי ניסיונות. נסו שוב בעוד מספר דקות.";

export const loginWithCode = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => z.object({ code: codeSchema }).parse(input))
  .handler(async ({ data }): Promise<Result<SessionTokens>> => {
    const ip = clientIp();
    if (await isRateLimited("login", ip)) return { ok: false, error: RATE_MSG, code: "RATE" };
    const db = await admin();
    const hash = await hashCode(data.code);
    const { data: profile } = await db.from("profiles").select("id, active").eq("code_hash", hash).maybeSingle();
    if (!profile) {
      await recordAttempt("login", ip, false);
      return { ok: false, error: "קוד שגוי" };
    }
    if (!profile.active) {
      await recordAttempt("login", ip, false);
      return { ok: false, error: "החשבון חסום. פנו למנהל הראשי." };
    }
    const { data: u } = await db.auth.admin.getUserById(profile.id);
    if (!u?.user?.email) return { ok: false, error: "שגיאה בטעינת החשבון" };
    const tokens = await issueSession(profile.id, u.user.email);
    await recordAttempt("login", ip, true);
    return { ok: true, data: tokens };
  });

export const registerUser = createServerFn({ method: "POST" })
  .inputValidator((input: { fullName: string; phone: string; code: string }) =>
    z.object({
      fullName: z.string().trim().min(2, "יש להזין שם מלא").max(100),
      phone: z.string().trim().regex(/^[0-9+\-\s]{9,15}$/, "מספר טלפון לא תקין"),
      code: codeSchema,
    }).parse(input),
  )
  .handler(async ({ data }): Promise<Result<SessionTokens>> => {
    const ip = clientIp();
    if (await isRateLimited("signup", ip)) return { ok: false, error: RATE_MSG, code: "RATE" };
    if (isEasyCode(data.code)) return { ok: false, error: EASY_CODE_MESSAGE, code: "EASY_CODE" };
    const db = await admin();
    const hash = await hashCode(data.code);
    const taken = await db.from("profiles").select("id", { count: "exact", head: true }).eq("code_hash", hash);
    if ((taken.count ?? 0) > 0) {
      await recordAttempt("signup", ip, false);
      return { ok: false, code: "CODE_TAKEN", error: TAKEN_CODE_MESSAGE };
    }
    const email = `u-${crypto.randomUUID()}@users.haraaya.local`;
    const { data: created, error } = await db.auth.admin.createUser({
      email, password: randomPassword(), email_confirm: true,
    });
    if (error || !created.user) return { ok: false, error: "ההרשמה נכשלה, נסו שוב" };
    const id = created.user.id;
    const { error: pErr } = await db.from("profiles").insert({
      id, full_name: data.fullName, phone: data.phone, code_hash: hash,
    });
    if (pErr) {
      await db.auth.admin.deleteUser(id);
      await recordAttempt("signup", ip, false);
      return { ok: false, code: "CODE_TAKEN", error: TAKEN_CODE_MESSAGE };
    }
    await db.from("user_roles").insert({ user_id: id, role: "user" });
    await recordAttempt("signup", ip, true);
    try { const { flushOutbox } = await import("@/lib/push.server"); await flushOutbox(db); } catch (e) { console.error("push flush", e); }
    return { ok: true, data: await issueSession(id, email) };
  });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** One-time bootstrap of the management accounts, protected by the ADMIN_SETUP_KEY secret. */
export const setupAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { setupKey: string; email: string; code: string }) =>
    z.object({
      setupKey: z.string().min(8).max(512),
      email: z.string().trim().toLowerCase().email(),
      code: codeSchema,
    }).parse(input),
  )
  .handler(async ({ data }): Promise<Result<SessionTokens>> => {
    const ip = clientIp();
    if (await isRateLimited("setup", ip)) return { ok: false, error: RATE_MSG, code: "RATE" };
    const expected = process.env["ADMIN_SETUP_KEY"] ?? "";
    if (!expected || !safeEqual(data.setupKey, expected)) {
      await recordAttempt("setup", ip, false);
      return { ok: false, error: "מפתח הגדרה שגוי" };
    }
    if (isEasyCode(data.code)) return { ok: false, error: EASY_CODE_MESSAGE, code: "EASY_CODE" };
    const db = await admin();
    const { data: seed } = await db.from("admin_seeds").select("*").eq("email", data.email).maybeSingle();
    if (!seed) return { ok: false, error: "כתובת זו אינה ברשימת חשבונות הניהול" };
    if (seed.claimed_at) return { ok: false, error: "חשבון זה כבר הוגדר. לשינוי קוד פנו למנהל הראשי." };
    const hash = await hashCode(data.code);
    const taken = await db.from("profiles").select("id", { count: "exact", head: true }).eq("code_hash", hash);
    if ((taken.count ?? 0) > 0) return { ok: false, code: "CODE_TAKEN", error: TAKEN_CODE_MESSAGE };

    // find or create auth user with the real email
    let userId: string | undefined;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data: list } = await db.auth.admin.listUsers({ page, perPage: 200 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === data.email)?.id;
      if (!list || list.users.length < 200) break;
    }
    if (!userId) {
      const { data: created, error } = await db.auth.admin.createUser({
        email: data.email, password: randomPassword(), email_confirm: true,
      });
      if (error || !created.user) return { ok: false, error: "יצירת החשבון נכשלה" };
      userId = created.user.id;
    }
    const { error: pErr } = await db.from("profiles").upsert({
      id: userId, full_name: seed.full_name, code_hash: hash, active: true,
    });
    if (pErr) return { ok: false, error: "שמירת החשבון נכשלה" };
    await db.from("user_roles").delete().eq("user_id", userId);
    await db.from("user_roles").insert({ user_id: userId, role: seed.role });
    await db.from("admin_seeds").update({ claimed_at: new Date().toISOString() }).eq("email", data.email);
    await recordAttempt("setup", ip, true);
    return { ok: true, data: await issueSession(userId, data.email) };
  });
