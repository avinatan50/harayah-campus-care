import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/QueryState";
import { supabase } from "@/integrations/supabase/client";
import { sendManualPush } from "@/lib/push.functions";
import { STATUS_LABELS, formatDate, type TaskStatus } from "@/lib/tasks";

/** Super admin: pause/resume own push notifications for every system change. */
export function AdminPushSettings({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: ["notification-preferences"], queryFn: async () => { const r = await supabase.from("notification_preferences").select("*").maybeSingle(); if (r.error) throw r.error; return r.data; } });
  const enabled = prefs.data?.push_enabled ?? true;
  const muted = prefs.data?.push_muted_until && new Date(prefs.data.push_muted_until) > new Date() ? prefs.data.push_muted_until : null;
  async function save(patch: { push_enabled?: boolean; push_muted_until?: string | null }) {
    const r = await supabase.from("notification_preferences").upsert({ ...prefs.data, user_id: userId, ...patch });
    if (r.error) toast.error("השמירה נכשלה"); else { toast.success("נשמר"); qc.invalidateQueries({ queryKey: ["notification-preferences"] }); }
  }
  const muteFor = (h: number) => save({ push_muted_until: new Date(Date.now() + h * 3600_000).toISOString() });
  return (
    <div className="space-y-3 rounded-xl border bg-card p-3 text-sm">
      <p className="font-semibold">התראות לנייד על כל שינוי במערכת</p>
      <p className="text-muted-foreground">קריאות חדשות, שינויי סטטוס, עדכונים, הערות, אישורים והרשמת משתמשים. מצב נוכחי: <b>{!enabled ? "כבוי לצמיתות" : muted ? `מושתק עד ${formatDate(muted)}` : "פעיל"}</b></p>
      <div className="flex flex-wrap gap-2">
        {enabled ? <>
          <Button size="sm" variant="outline" onClick={() => muteFor(1)}>השתקה לשעה</Button>
          <Button size="sm" variant="outline" onClick={() => muteFor(8)}>ל־8 שעות</Button>
          <Button size="sm" variant="outline" onClick={() => muteFor(24)}>ליום</Button>
          {muted && <Button size="sm" onClick={() => save({ push_muted_until: null })}>ביטול השתקה</Button>}
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => save({ push_enabled: false })}>כיבוי קבוע</Button>
        </> : <Button size="sm" onClick={() => save({ push_enabled: true, push_muted_until: null })}>הפעלה מחדש</Button>}
      </div>
    </div>
  );
}

type Change = { id: number; task_id: string; old_value: string | null; new_value: string | null; created_at: string; tasks: { number: number; title: string; created_by: string | null } | null };

/** Super admin: send a notification about a status change to the reporter and/or chosen staff. */
export function SendPushTab() {
  const changes = useQuery({ queryKey: ["tasks", "status-changes"], queryFn: async () => {
    const r = await supabase.from("task_history").select("id,task_id,old_value,new_value,created_at,tasks(number,title,created_by)").eq("field", "status").order("created_at", { ascending: false }).limit(40);
    if (r.error) throw r.error; return r.data as unknown as Change[];
  } });
  const staff = useQuery({ queryKey: ["push-staff"], queryFn: async () => {
    const [roles, profiles] = await Promise.all([supabase.from("user_roles").select("user_id,role").in("role", ["staff", "super_admin"]), supabase.from("profiles").select("id,full_name,active,deleted_at")]);
    if (roles.error || profiles.error) throw new Error("טעינת המשתמשים נכשלה");
    const ids = new Set(roles.data.map((r) => r.user_id));
    return profiles.data.filter((p) => ids.has(p.id) && p.active && !p.deleted_at);
  } });
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">בחרו שינוי סטטוס, ולחצו „שליחת התראה” כדי לבחור למי לשלוח.</p>
      <QueryState loading={changes.isLoading} error={changes.error} retry={() => changes.refetch()} />
      <ul className="divide-y border-y">
        {changes.data?.map((c) => <li key={c.id} className="space-y-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm"><p className="font-semibold">#{c.tasks?.number} {c.tasks?.title}</p>
              <p className="text-muted-foreground">{STATUS_LABELS[c.old_value as TaskStatus] ?? c.old_value ?? "—"} ← {STATUS_LABELS[c.new_value as TaskStatus] ?? c.new_value} · {formatDate(c.created_at)}</p></div>
            <Button size="sm" variant={openId === c.id ? "secondary" : "outline"} onClick={() => setOpenId(openId === c.id ? null : c.id)}><Send className="size-4" />שליחת התראה</Button>
          </div>
          {openId === c.id && <SendForm change={c} staff={staff.data ?? []} onDone={() => setOpenId(null)} />}
        </li>)}
      </ul>
      {changes.data?.length === 0 && <p>אין שינויי סטטוס עדיין</p>}
    </div>
  );
}

function SendForm({ change, staff, onDone }: { change: Change; staff: { id: string; full_name: string }[]; onDone: () => void }) {
  const reporter = change.tasks?.created_by ?? null;
  const [picked, setPicked] = useState<Set<string>>(new Set(reporter ? [reporter] : []));
  const [title, setTitle] = useState(`עדכון בקריאה #${change.tasks?.number ?? ""}`);
  const [body, setBody] = useState(`${change.tasks?.title ?? ""}: ${STATUS_LABELS[change.new_value as TaskStatus] ?? change.new_value ?? ""}`);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function send() {
    if (!picked.size) { toast.error("יש לבחור לפחות נמען אחד"); return; }
    setBusy(true);
    try {
      const r = await sendManualPush({ data: { userIds: [...picked], taskId: change.task_id, title, body } });
      toast.success(`ההתראה נשלחה (${r.sent} מכשירים)` + (r.missing ? ` · ${r.missing} נמענים טרם הפעילו התראות` : ""));
      onDone();
    } catch { toast.error("השליחה נכשלה"); }
    setBusy(false);
  }
  return (
    <div className="space-y-3 rounded-xl border bg-muted/40 p-3 text-sm">
      <p className="font-semibold">למי לשלוח?</p>
      <div className="grid gap-1 sm:grid-cols-2">
        {reporter && <label className="flex items-center gap-2"><input type="checkbox" checked={picked.has(reporter)} onChange={() => toggle(reporter)} />פותח הקריאה</label>}
        {staff.filter((s) => s.id !== reporter).map((s) => <label key={s.id} className="flex items-center gap-2"><input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />{s.full_name}</label>)}
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="כותרת" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} aria-label="תוכן ההודעה" />
      <Button size="sm" disabled={busy} onClick={send}><Send className="size-4" />שליחה ({picked.size})</Button>
    </div>
  );
}
