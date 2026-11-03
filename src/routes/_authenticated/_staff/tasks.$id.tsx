import type { Database } from "@/integrations/supabase/types";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Archive, ArchiveRestore, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { TaskForm, toFormValues, toPayload } from "@/components/TaskForm";
import { StatusBadge, TaskRow } from "@/components/TaskRow";
import { TaskResolution } from "@/components/TaskResolution";
import { requiresResolution } from "@/lib/task-resolution";

function openResolution(taskId: string) {
  toast.info("שינוי סטטוס מחייב תיעוד תוצאה והערה");
  const el = document.getElementById(`note-${taskId}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  (el as HTMLTextAreaElement | null)?.focus();
}
import { FilePicker } from "@/components/FilePicker";
import {
  HIDDEN_TASK_FIELDS, FIELD_LABELS, profilesQuery, STATUS_LABELS, STATUS_OPTIONS, TYPE_LABELS, URGENCY_LABELS,
  uploadTaskFiles, formatDate, type TaskStatus, type Task,
} from "@/lib/tasks";
import { pageHead } from "@/lib/metadata";

export const Route = createFileRoute("/_authenticated/_staff/tasks/$id")({
  head: () => pageHead("פרטי משימה", "פרטי משימה, החלטות, ציר זמן, קבצים ותת־משימות"),
  component: TaskDetail,
});

const fmt = formatDate;

function TaskDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const profiles = useQuery(profilesQuery);
  const name = (uid: string | null) => (uid ? profiles.data?.find((p) => p.id === uid)?.full_name ?? "—" : "—");
  const task = useQuery({
    queryKey: ["tasks", "one", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const [conflict, setConflict] = useState(false);
  async function update(patch: Database["public"]["Tables"]["tasks"]["Update"], msg = "נשמר"): Promise<void> {
    if (!task.data || busy) return;
    setBusy(true);
    const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).eq("updated_at", task.data.updated_at).select("id");
    setBusy(false);
    if (error) { if (error.message.includes("RESOLUTION_REQUIRED")) { toast.error("יש לתעד אישור/החלטה עם הערה"); openResolution(id); return; } toast.error(error.message.includes("SAFETY_CHECK_REQUIRED") ? "נדרשים תיעוד תיקון ובדיקת תקינות חדשה" : "השמירה נכשלה"); return; }
    if (!data?.length) { setConflict(true); toast.error("משתמש אחר עדכן את המשימה. טענו את הגרסה העדכנית."); return; }
    toast.success(msg);
    refresh();
  }

  if (task.isLoading) return <p className="text-muted-foreground">טוען…</p>;
  if (task.error) return <p className="text-destructive">שגיאה בטעינה <button className="underline" onClick={() => task.refetch()}>נסו שוב</button></p>;
  const t = task.data;
  if (!t) return <p>המשימה לא נמצאה. <Link to="/dashboard" className="text-primary underline">ללוח הבקרה</Link></p>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {conflict && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning/20 p-3"><span>השינויים לא נשמרו כי המשימה עודכנה על ידי משתמש אחר.</span><Button size="sm" onClick={async()=>{setConflict(false);await task.refetch();}}>טעינת הגרסה העדכנית</Button></div>}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">#{t.number}</span> · {TYPE_LABELS[t.type]} · דחיפות {URGENCY_LABELS[t.urgency]}
              {t.archived && <span className="rounded-full bg-muted px-2 text-xs">בארכיון</span>}
            </div>
            <h1 className="mt-1 text-2xl font-bold">{t.title}</h1>
            {t.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{t.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <select
              aria-label="שינוי סטטוס"
              className="h-9 rounded-md border border-input bg-card px-2 text-sm"
              value={t.status}
              disabled={busy}
              onChange={(e) => { if (requiresResolution(t.status)) { openResolution(t.id); return; } update({ status: e.target.value as TaskStatus }, "הסטטוס עודכן"); }}
            >
              {STATUS_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => { if (t.archived || confirm("להעביר את המשימה לארכיון? ניתן לשחזר אותה בכל עת.")) update({ archived: !t.archived }, t.archived ? "שוחזר מהארכיון" : "הועבר לארכיון"); }}>
              {t.archived ? <><ArchiveRestore className="size-4" /> שחזור</> : <><Archive className="size-4" /> ארכוב</>}
            </Button>
          </div>
        </div>
        {t.is_safety && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" /> מפגע בטיחותי{t.equipment_disabled ? " · הציוד מושבת משימוש" : t.safety_checked_at ? ` · נבדק לפני החזרה: ${fmt(t.safety_checked_at)} · ${name(t.safety_checked_by)}` : ""}
          </div>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <Info k="אחראי" v={name(t.assignee_id)} />
          <Info k="מיקום" v={t.location ?? "—"} />
          <Info k="נפתח" v={`${fmt(t.created_at)} · ${name(t.created_by)}`} />
          <Info k="עדכון אחרון" v={`${fmt(t.updated_at)} · ${name(t.updated_by)}`} />
          <Info k="הושלם" v={t.completed_at ? `${fmt(t.completed_at)} · ${name(t.completed_by)}` : "—"} />
          {t.next_step && <Info k="נדרש להתקדם" v={t.next_step} />}
          {t.external_party && <Info k="גורם חיצוני" v={t.external_party} />}
        </dl>
        {t.parent_id && <ParentLink id={t.parent_id} />}
        {t.related_task_id && <Original id={t.related_task_id} discovered={t.created_at} name={name} />}
      </div>

      <TaskResolution key={`resolution-${t.updated_at}`} task={t} />

      <Tabs defaultValue="details">
        <TabsList className="flex-wrap">
          <TabsTrigger value="details">פרטים ועריכה</TabsTrigger>
          <TabsTrigger value="timeline">ציר זמן</TabsTrigger>
          <TabsTrigger value="comments">הערות</TabsTrigger>
          <TabsTrigger value="subtasks">תת־משימות</TabsTrigger>
          <TabsTrigger value="files">קבצים</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="rounded-2xl border bg-card p-5">
          <TaskForm key={t.updated_at} mode="edit" initial={toFormValues(t)} busy={busy} onSubmit={(v) => { const { explicit_status: _ignored, ...payload } = toPayload(v); update(payload); }} />
        </TabsContent>
        <TabsContent value="timeline"><Decisions taskId={id} name={name} /><Timeline taskId={id} name={name} /></TabsContent>
        <TabsContent value="comments"><Comments taskId={id} name={name} /></TabsContent>
        <TabsContent value="subtasks"><Subtasks taskId={id} /></TabsContent>
        <TabsContent value="files"><Files taskId={id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ k, v, danger, extra }: { k: string; v: string; danger?: boolean; extra?: string | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className={danger ? "font-semibold text-destructive" : ""}>{v}{extra ? ` · ${extra}` : ""}</dd>
    </div>
  );
}

function display(field: string | null, val: string | null, name: (id: string | null) => string) {
  if (val === null) return "—";
  if (field === "status") return STATUS_LABELS[val as TaskStatus] ?? val;
  if (field === "type") return TYPE_LABELS[val as keyof typeof TYPE_LABELS] ?? val;
  if (field === "urgency") return URGENCY_LABELS[val as keyof typeof URGENCY_LABELS] ?? val;
  if (field === "assignee_id") return name(val);
  if (val === "true") return "כן";
  if (val === "false") return "לא";
  return val;
}

const ACTIONS: Record<string, string> = { created: "נפתחה המשימה", status_change: "שינוי סטטוס", updated: "עדכון", archived: "הועבר לארכיון", restored: "שוחזר מהארכיון", decision: "תועדה החלטה" };

function ParentLink({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["tasks", "one", id, "short"], queryFn: async () => { const r = await supabase.from("tasks").select("id,number,title").eq("id", id).maybeSingle(); if (r.error) throw r.error; return r.data; } });
  return q.data ? <p className="mt-3 text-sm">משימה ראשית: <Link className="text-primary" to="/tasks/$id" params={{ id }}>#{q.data.number} {q.data.title}</Link></p> : null;
}
function Original({ id, discovered, name }: { id: string; discovered: string; name: (id: string | null) => string }) {
  const q = useQuery({ queryKey: ["tasks", "one", id], queryFn: async () => { const r = await supabase.from("tasks").select("*").eq("id", id).maybeSingle(); if (r.error) throw r.error; return r.data; } });
  const o = q.data;
  return o ? <div className="mt-3 rounded-lg bg-muted p-3 text-sm"><strong>תקלה לאחר ביצוע</strong><p>המשימה המקורית <Link className="text-primary" to="/tasks/$id" params={{ id }}>#{o.number} {o.title}</Link> בוצעה ב־{fmt(o.completed_at)} על ידי {name(o.completed_by)}.</p><p>התקלה הנוספת התגלתה ב־{fmt(discovered)}.</p></div> : null;
}
function Decisions({ taskId, name }: { taskId: string; name: (id: string | null) => string }) {
  const q = useQuery({ queryKey: ["tasks", "decisions", taskId], queryFn: async () => { const r = await supabase.from("task_decisions").select("*").eq("task_id", taskId).order("created_at", { ascending: false }); if (r.error) throw r.error; return r.data; } });
  if (!q.data?.length) return null;
  return <section className="mb-4 rounded-2xl border bg-card p-5"><h2 className="mb-3 font-semibold">החלטות</h2><ul className="space-y-3 text-sm">{q.data.map(d => <li key={d.id}><strong>{({ approved: "אושר", rejected: "נדחה", instruction: "הנחיה אחרת" } as Record<string, string>)[d.outcome]}</strong> · {fmt(d.created_at)} · {name(d.user_id)}<p className="whitespace-pre-wrap">{d.body}</p>{d.approved_amount !== null && <p>סכום מאושר: ₪{d.approved_amount.toLocaleString("he-IL")}</p>}<p>סטטוס המשך: {STATUS_LABELS[d.next_status]}</p>{d.destination_type && <p>הועבר ל: {TYPE_LABELS[d.destination_type]}</p>}</li>)}</ul></section>;
}

function Timeline({ taskId, name }: { taskId: string; name: (id: string | null) => string }) {
  const q = useQuery({
    queryKey: ["tasks", "history", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_history").select("*").eq("task_id", taskId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <ol className="space-y-2 rounded-2xl border bg-card p-5 text-sm">
      {q.data?.filter(h => !h.field || !HIDDEN_TASK_FIELDS.includes(h.field)).map((h) => (
        <li key={h.id} className="border-r-2 border-primary/40 pr-3">
          <div className="text-xs text-muted-foreground">{fmt(h.created_at)} · {name(h.user_id)}</div>
          <div>
            <span className="font-semibold">{ACTIONS[h.action] ?? h.action}</span>
            {h.field && h.action !== "archived" && h.action !== "restored" && (
              <> · {FIELD_LABELS[h.field] ?? h.field}: <span className="text-muted-foreground line-through">{display(h.field, h.old_value, name)}</span> ← {display(h.field, h.new_value, name)}</>
            )}
            {h.action === "created" && <> · {display("status", h.new_value, name)}</>}
          </div>
        </li>
      ))}
      {q.data?.length === 0 && <li className="text-muted-foreground">אין רישומים</li>}
    </ol>
  );
}

function Comments({ taskId, name }: { taskId: string; name: (id: string | null) => string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const q = useQuery({
    queryKey: ["tasks", "comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [sending, setSending] = useState(false);
  async function add() {
    if (!body.trim() || sending) return;
    setSending(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSending(false); return; }
    const { error } = await supabase.from("task_comments").insert({ task_id: taskId, body: body.trim().slice(0, 5000), user_id: u.user.id });
    setSending(false);
    if (error) { toast.error("ההערה לא נשמרה"); return; }
    setBody("");
    qc.invalidateQueries({ queryKey: ["tasks", "comments", taskId] });
  }
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-5">
      {q.data?.map((c) => (
        <div key={c.id} className="rounded-lg bg-muted p-3 text-sm">
          <div className="text-xs text-muted-foreground">{name(c.user_id)} · {fmt(c.created_at)}</div>
          <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
        </div>
      ))}
      <Textarea rows={2} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="הוספת הערה…" />
      <Button size="sm" onClick={add} disabled={sending || !body.trim()}>{sending ? "שומר…" : "הוספה"}</Button>
    </div>
  );
}

function Subtasks({ taskId }: { taskId: string }) {
  const qc = useQueryClient();
  const profiles = useQuery(profilesQuery);
  const [draft, setDraft] = useState({ title: "", assignee_id: "", status: "new" as TaskStatus, key: crypto.randomUUID() });
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["tasks", "children", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("parent_id", taskId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="rounded-2xl border bg-card">
      <ul className="divide-y">{q.data?.map((t) => <SubtaskRow key={t.id} task={t} />)}</ul>
      {q.data?.length === 0 && <p className="p-5 text-sm text-muted-foreground">אין תת־משימות</p>}
      <div className="border-t p-4">
        <form className="grid gap-2 md:grid-cols-[1fr_150px_150px_auto]" onSubmit={async e => { e.preventDefault(); if (!draft.title.trim() || busy) return; setBusy(true); const r = await supabase.from("tasks").insert({ title: draft.title.trim(), assignee_id: draft.assignee_id || null, status: draft.status, explicit_status: true, parent_id: taskId, request_key: draft.key }).select("id").single(); setBusy(false); if (r.error && r.error.code !== "23505") { toast.error("תת־המשימה לא נשמרה"); return; } setDraft({ title: "", assignee_id: "", status: "new", key: crypto.randomUUID() }); qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("תת־המשימה נוספה"); }}>
          <Input aria-label="כותרת תת־משימה" placeholder="כותרת תת־משימה" maxLength={200} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          <select aria-label="אחראי לתת־משימה" className="h-10 rounded-md border bg-card px-2" value={draft.assignee_id} onChange={e => setDraft({ ...draft, assignee_id: e.target.value })}><option value="">ללא אחראי</option>{profiles.data?.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
          <select aria-label="סטטוס לתת־משימה" className="h-10 rounded-md border bg-card px-2" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as TaskStatus })}>{STATUS_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <Button disabled={busy || !draft.title.trim()}>{busy ? "שומר…" : "+ תת־משימה"}</Button>
        </form>
      </div>
    </div>
  );
}
function SubtaskRow({ task }: { task: Task }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return <li className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><TaskRow task={task} /></div><select aria-label={`סטטוס ${task.title}`} className="m-2 h-9 rounded-md border bg-card px-2 text-sm" value={task.status} onChange={async e => { if (requiresResolution(task.status)) { toast.info("נדרש לתעד אישור/החלטה בדף תת־המשימה"); void navigate({ to: "/tasks/$id", params: { id: task.id } }); return; } const r = await supabase.from("tasks").update({ status: e.target.value as TaskStatus }).eq("id", task.id).eq("updated_at", task.updated_at).select("id"); if (r.error || !r.data?.length) toast.error("הסטטוס לא עודכן; טענו את הגרסה העדכנית"); qc.invalidateQueries({ queryKey: ["tasks"] }); }}>{STATUS_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></li>;
}

function Files({ taskId }: { taskId: string }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const q = useQuery({
    queryKey: ["tasks", "files", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_files").select("*").eq("task_id", taskId).order("created_at");
      if (error) throw error;
      const signed = await Promise.all(data.map(async (f) => {
        const s = await supabase.storage.from("task-files").createSignedUrl(f.path, 3600);
        return { ...f, url: s.data?.signedUrl };
      }));
      return signed;
    },
  });
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {q.data?.map((f) => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border text-xs">
            {f.mime_type?.startsWith("image/") && f.url ? <img src={f.url} alt={f.file_name} className="h-28 w-full object-cover" />
              : <div className="flex h-28 items-center justify-center bg-muted"><FileIcon className="size-8 text-muted-foreground" /></div>}
            <div className="truncate p-2">{f.file_name}</div>
          </a>
        ))}
      </div>
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">אין קבצים</p>}
      <FilePicker files={files} onChange={setFiles} />
      {files.length > 0 && (
        <Button size="sm" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await uploadTaskFiles(taskId, files, (d, n) => setProgress(`${d}/${n}`)); setFiles([]); toast.success("הקבצים הועלו"); }
          catch { toast.error("ההעלאה נכשלה. קבצים שלא הועלו נשארו ברשימה."); }
          setBusy(false); setProgress("");
          qc.invalidateQueries({ queryKey: ["tasks", "files", taskId] });
        }}>{busy ? `מעלה ${progress}` : "העלאה"}</Button>
      )}
    </div>
  );
}
