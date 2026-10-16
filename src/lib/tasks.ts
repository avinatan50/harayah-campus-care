import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TaskType = Database["public"]["Enums"]["task_type"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskUrgency = Database["public"]["Enums"]["task_urgency"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];

export const TYPE_LABELS: Record<TaskType, string> = {
  task: "משימה", fault: "תקלה", request: "בקשה", decision: "החלטה נדרשת",
};
export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: "חדש",
  in_progress: "בטיפול",
  waiting_decision: "ממתין להחלטה",
  waiting_approval: "ממתין לאישור",
  waiting_external: "ממתין לגורם חיצוני",
  paused: "מושהה",
  done_pending_close: "בוצע — ממתין לסגירה",
  closed: "הושלם ונסגר",
  recurring_fault: "תקלה חוזרת / לאחר ביצוע",
  cancelled: "בוטל",
};
export const URGENCY_LABELS: Record<TaskUrgency, string> = {
  normal: "רגילה", high: "גבוהה", critical: "קריטית",
};
export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "מנהל ראשי", staff: "מנהלה", user: "משתמש רגיל",
};
export const FIELD_LABELS: Record<string, string> = {
  title: "כותרת", description: "תיאור", type: "סוג", status: "סטטוס", urgency: "דחיפות",
  assignee_id: "אחראי", due_date: "מועד יעד", location: "מיקום", is_safety: "מפגע בטיחותי",
  equipment_disabled: "מושבת משימוש", next_step: "מה נדרש להתקדם", external_party: "גורם חיצוני",
  delay_reason: "סיבת עיכוב", delay_impact: "השלכות העיכוב", requested_amount: "סכום מבוקש",
  parent_id: "משימת אב", related_task_id: "משימה קשורה", archived: "ארכיון",
  repair_notes: "תיעוד תיקון", safety_check: "בדיקת תקינות", safety_checked_at: "מועד בדיקת תקינות", safety_checked_by: "בודק תקינות", completed_by: "סגר את המשימה", completed_at: "מועד השלמה", waiting_since: "תחילת המתנה",
};

export const CLOSED_STATUSES: TaskStatus[] = ["closed", "cancelled"];
export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export const formatDate = (d: string | null) => d ? new Date(d).toLocaleString('he-IL', {timeZone:'Asia/Jerusalem',dateStyle:'short',timeStyle:'short'}) : '—';
export const waitingDays = (d: string | null) => d ? Math.max(0,Math.floor((Date.now()-new Date(d).getTime())/86400000)) : 0;

/** Single source of truth for dashboard counters and list filters. */
export type Preset =
  | "open" | "waiting_approval" | "waiting_decision" | "waiting_external"
  | "overdue" | "done" | "safety" | "archived" | "all";

export const PRESET_LABELS: Record<Preset, string> = {
  open: "משימות פתוחות",
  waiting_approval: "ממתין לאישור",
  waiting_decision: "ממתין להחלטה",
  waiting_external: "ממתין לגורם חיצוני",
  overdue: "משימות באיחור",
  done: "הושלמו",
  safety: "מפגעי בטיחות פתוחים",
  archived: "ארכיון",
  all: "כל המשימות (ללא ארכיון)",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyPreset<Q extends { eq: any; not: any; lt: any }>(q: Q, preset: Preset): Q {
  const notClosed = `(${CLOSED_STATUSES.join(",")})`;
  switch (preset) {
    case "archived": return q.eq("archived", true);
    case "all": return q.eq("archived", false);
    case "open": return q.eq("archived", false).not("status", "in", notClosed);
    case "overdue": return q.eq("archived", false).not("status", "in", notClosed).lt("due_date", todayISO());
    case "safety": return q.eq("archived", false).not("status", "in", notClosed).eq("is_safety", true);
    case "done": return q.eq("archived", false).eq("status", "closed");
    default: return q.eq("archived", false).eq("status", preset);
  }
}

export type Me = { id: string; fullName: string; role: AppRole; active: boolean };

export const meQuery = queryOptions({
  queryKey: ["me"],
  staleTime: 30_000,
  queryFn: async (): Promise<Me> => {
    const { data: u, error } = await supabase.auth.getUser();
    if (error || !u.user) throw new Error("לא מחובר");
    const [p, r] = await Promise.all([
      supabase.from("profiles").select("id, full_name, active").eq("id", u.user.id).single(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    if (p.error) throw new Error("טעינת החשבון נכשלה");
    if (r.error) throw new Error("טעינת ההרשאות נכשלה");
    const roles = (r.data ?? []).map((x) => x.role);
    const role: AppRole | undefined = roles.includes("super_admin") ? "super_admin" : roles.includes("staff") ? "staff" : roles.includes("user") ? "user" : undefined;
    if (!role) throw new Error("לא הוגדר תפקיד לחשבון");
    return { id: p.data.id, fullName: p.data.full_name, role, active: p.data.active };
  },
});

export const profilesQuery = queryOptions({
  queryKey: ["profiles"],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name, active").order("full_name");
    if (error) throw error;
    return data;
  },
});

export const locationsQuery = queryOptions({
  queryKey: ["locations"],
  queryFn: async () => {
    const { data, error } = await supabase.from("locations").select("name").order("name");
    if (error) throw error;
    return data.map((l) => l.name);
  },
});

export const isOverdue = (t: Pick<Task, "due_date" | "status" | "archived">) =>
  !!t.due_date && !t.archived && !CLOSED_STATUSES.includes(t.status) && t.due_date < todayISO();

export async function uploadTaskFiles(taskId: string, files: File[], progress?: (done:number,total:number)=>void) {
  let done=0;
  for (const f of files) {
    if(f.size>50*1024*1024) throw new Error('הקובץ גדול מדי');
    const path = `${taskId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
    const up = await supabase.storage.from("task-files").upload(path, f, { contentType: f.type });
    if (up.error) throw up.error;
    const ins = await supabase.from("task_files").insert({
      task_id: taskId, path, file_name: f.name, mime_type: f.type, size: f.size,
    });
    if (ins.error) throw ins.error;
    progress?.(++done,files.length);
  }
}
