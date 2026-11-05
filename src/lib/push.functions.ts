import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { vapidKeys } = await import("@/lib/push.server");
  return (await vapidKeys()).publicKey;
});

/** Deliver any queued notifications right away (also runs every minute on a schedule). */
export const kickPush = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { flushOutbox } = await import("@/lib/push.server");
  await flushOutbox(supabaseAdmin);
  return { ok: true };
});

const sendSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
  taskId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(300),
});

/** Super admin sends a manual notification to chosen users. */
export const sendManualPush = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof sendSchema>) => sendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!allowed) throw new Error("אין הרשאה לשליחת התראות");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { deliver } = await import("@/lib/push.server");
    let reporter: string | null = null;
    if (data.taskId) {
      const t = await db.from("tasks").select("created_by").eq("id", data.taskId).single();
      reporter = t.data?.created_by ?? null;
    }
    const { data: staffRoles } = await db.from("user_roles").select("user_id,role").in("user_id", data.userIds);
    const staffSet = new Set((staffRoles ?? []).filter((r) => r.role !== "user").map((r) => r.user_id));
    const items = data.userIds.map((uid) => ({
      user_id: uid, title: data.title, body: data.body,
      url: staffSet.has(uid) && data.taskId ? `/tasks/${data.taskId}` : uid === reporter ? "/report" : "/",
    }));
    const { data: subs } = await db.from("push_subscriptions").select("user_id").in("user_id", data.userIds);
    const withDevice = new Set((subs ?? []).map((s) => s.user_id));
    const sent = await deliver(db, items);
    return { sent, missing: data.userIds.filter((u) => !withDevice.has(u)).length };
  });
