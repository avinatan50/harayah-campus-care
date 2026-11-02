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
  waiting_approval: "ממתין לאישור",
  waiting_decision: "ממתין להחלטה",
  waiting_external: "ממתין לגורם חיצוני",
  approved: "מאושר",
  closed: "טופל",
  paused: "מושהה",
  cancelled: "בוטל",
  done_pending_close: "טופל",
  recurring_fault: "חדש",
};
export const STATUS_ORDER: TaskStatus[] = ['new', 'in_progress', 'waiting_approval', 'waiting_decision', 'waiting_external', 'approved', 'closed', 'paused', 'cancelled'];
export const STATUS_OPTIONS = STATUS_ORDER.map((status): [TaskStatus, string] => [status, STATUS_LABELS[status]]);
export const normalizeStatus = (status: TaskStatus): TaskStatus => status === 'done_pending_close' ? 'closed' : status === 'recurring_fault' ? 'new' : status;
export const URGENCY_LABELS: Record<TaskUrgency, string> = {
  normal: "רגילה", high: "גבוהה", critical: "קריטית",
};
export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "מנהל ראשי", staff: "מנהלה", user: "משתמש רגיל",
};
export const FIELD_LABELS: Record<string, string> = {
  title: "כותרת", description: "תיאור", type: "סוג", status: "סטטוס", urgency: "דחיפות",
  assignee_id: "אחראי", location: "מיקום", is_safety: "מפגע בטיחותי",
  equipment_disabled: "מושבת משימוש", next_step: "מה נדרש להתקדם", external_party: "גורם חיצוני",
  requested_amount: "סכום מבוקש",
  parent_id: "משימת אב", related_task_id: "משימה קשורה", archived: "ארכיון",
  repair_notes: "תיעוד תיקון", safety_check: "בדיקת תקינות", safety_checked_at: "מועד בדיקת תקינות", safety_checked_by: "בודק תקינות", completed_by: "סגר את המשימה", completed_at: "מועד השלמה",
};

export const CLOSED_STATUSES: TaskStatus[] = ["closed", "cancelled"];
export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export const formatDate = (d: string | null) => d ? new Date(d).toLocaleString('he-IL', {timeZone:'Asia/Jerusalem',dateStyle:'short',timeStyle:'short'}) : '—';
export const HIDDEN_TASK_FIELDS = ["due_date", "waiting_since", "delay_reason", "delay_impact"];
export const initialStatusFor = (type: TaskType, selected: TaskStatus | ""): TaskStatus => type === "request" ? "waiting_approval" : type === "decision" ? "waiting_decision" : selected || "new";

/** Presets a role may see: staff get "my_action" instead of safety hazards. */
export const presetsForRole = (role: AppRole | undefined): Preset[] =>
  role === "staff"
    ? ["open", "waiting_approval", "waiting_decision", "waiting_external", "done", "my_action", "all"]
    : ["open", "waiting_approval", "waiting_decision", "waiting_external", "done", "safety", "my_action", "archived", "all"];
export const attentionPresetFor = (role: AppRole | undefined): Preset => (role === "staff" ? "my_action" : "safety");

/** Single source of truth for dashboard counters and list filters. */
export type Preset =
  | "open" | "waiting_approval" | "waiting_decision" | "waiting_external"
  | "done" | "safety" | "my_action" | "archived" | "all";

export const PRESET_LABELS: Record<Preset, string> = {
  open: "משימות פתוחות",
  waiting_approval: "ממתין לאישור",
  waiting_decision: "ממתין להחלטה",
  waiting_external: "ממתין לגורם חיצוני",
  done: "טופלו",
  safety: "מפגעי בטיחות פתוחים",
  my_action: "ממתין לפעולה שלי",
  archived: "ארכיון",
  all: "כל המשימות",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyPreset<Q extends { eq: any; not: any; lt: any; in: any }>(q: Q, preset: Preset, _userId?: string): Q {
  const notClosed = `(${CLOSED_STATUSES.join(",")})`;
  switch (preset) {
    case "archived": return q.eq("archived", true);
    case "all": return q.eq("archived", false);
    case "open": return q.eq("archived", false).not("status", "in", notClosed);
    case "safety": return q.eq("archived", false).not("status", "in", notClosed).eq("is_safety", true);
    case "my_action": return q.eq("archived", false).in("status", ["waiting_approval", "waiting_decision"]);
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

export type LocationNode = { id: string; name: string; parent_id: string | null };

export const locationsQuery = queryOptions({
  queryKey: ["locations"],
  queryFn: async (): Promise<LocationNode[]> => {
    const { data, error } = await supabase.from("locations").select("id, name, parent_id").order("name");
    if (error) throw error;
    return data;
  },
});

/** Children of a location (null = top level). */
export const locationChildren = (locs: LocationNode[], parentId: string | null) =>
  locs.filter((l) => l.parent_id === parentId);

/** Full path string, e.g. "בנין א › קומה 1 › כיתה 3". */
export function locationPath(locs: LocationNode[], id: string): string {
  const parts: string[] = [];
  let cur = locs.find((l) => l.id === id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = locs.find((l) => l.id === cur!.parent_id);
  }
  return parts.join(" › ");
}

/** Suggest a location by matching location names against the task title/description. */
export function suggestLocation(locs: LocationNode[], text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  // Prefer the most specific (longest) matching name.
  const matches = locs.filter((l) => l.name.length >= 2 && t.includes(l.name));
  if (!matches.length) return null;
  matches.sort((a, b) => b.name.length - a.name.length);
  return locationPath(locs, matches[0]!.id);
}

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

export type ReportFile = { id: string; task_id: string; path: string; file_name: string; mime_type: string | null };
export type MyReport = {
  id: string; number: number; title: string; description: string | null;
  status: TaskStatus; created_at: string; updated_at: string;
  files: ReportFile[]; last_note: string | null;
};

/** Newest note a manager left while moving this call's status; null when none was given. */
export function latestDecisionNote(decisions: { task_id: string; body: string; created_at: string }[], taskId: string): string | null {
  const own = decisions.filter((d) => d.task_id === taskId);
  if (!own.length) return null;
  own.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return own[0]!.body;
}

/** The signed-in reporter's own calls, newest first. */
export const myReportsQuery = (userId: string) => queryOptions({
  queryKey: ["my-reports", userId],
  staleTime: 15_000,
  queryFn: async (): Promise<MyReport[]> => {
    const { data: rows, error } = await supabase.from("tasks")
      .select("id, number, title, description, status, created_at, updated_at")
      .eq("created_by", userId).eq("archived", false)
      .order("updated_at", { ascending: false }).limit(100);
    if (error) throw error;
    const ids = (rows ?? []).map((r) => r.id);
    if (!ids.length) return [];
    const [f, d] = await Promise.all([
      supabase.from("task_files").select("id, task_id, path, file_name, mime_type").in("task_id", ids).order("created_at"),
      supabase.from("task_decisions").select("task_id, body, created_at").in("task_id", ids).order("created_at"),
    ]);
    if (f.error) throw f.error;
    if (d.error) throw d.error;
    const files = f.data ?? [];
    const decisions = d.data ?? [];
    return rows.map((r) => ({ ...r, files: files.filter((x) => x.task_id === r.id), last_note: latestDecisionNote(decisions, r.id) }));
  },
});
