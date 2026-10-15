import type { Database } from "@/integrations/supabase/types";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Archive, ArchiveRestore, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { TaskForm, toFormValues, toPayload } from "@/components/TaskForm";
import { StatusBadge, TaskRow } from "@/components/TaskRow";
import { FilePicker } from "@/components/FilePicker";
import {
  FIELD_LABELS, isOverdue, profilesQuery, STATUS_LABELS, TYPE_LABELS, URGENCY_LABELS,
  uploadTaskFiles, type TaskStatus,
} from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/_staff/tasks/$id")({
  head: () => ({ meta: [{ title: "פרטי משימה – הראי״ה" }, { name: "description", content: "פרטי משימה וציר זמן" }] }),
  component: TaskDetail,
});

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—");

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

  async function update(patch: Database["public"]["Tables"]["tasks"]["Update"], msg = "נשמר"): Promise<void> {
    setBusy(true);
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    setBusy(false);
    if (error) { toast.error("השמירה נכשלה"); return; }
    toast.success(msg);
    refresh();
  }

  if (task.isLoading) return <p className="text-muted-foreground">טוען…</p>;
  if (task.error) return <p className="text-destructive">שגיאה בטעינה <button className="underline" onClick={() => task.refetch()}>נסו שוב</button></p>;
  const t = task.data;
  if (!t) return <p>המשימה לא נמצאה. <Link to="/dashboard" className="text-primary underline">ללוח הבקרה</Link></p>;
  const late = isOverdue(t);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">#{t.number}</span> · {TYPE_LABELS[t.type]} · דחיפות {URGENCY_LABELS[t.urgency]}
              {t.archived && <span className="rounded-full bg-muted px-2 text-xs">בארכיון</span>}
            </div>
            <h1 className="mt-1 text-2xl font-bold">{t.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <select
              aria-label="שינוי סטטוס"
              className="h-9 rounded-md border border-input bg-card px-2 text-sm"
              value={t.status}
              disabled={busy}
              onChange={(e) => update({ status: e.target.value as TaskStatus }, "הסטטוס עודכן")}
            >
              {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => update({ archived: !t.archived }, t.archived ? "שוחזר מהארכיון" : "הועבר לארכיון")}>
              {t.archived ? <><ArchiveRestore className="size-4" /> שחזור</> : <><Archive className="size-4" /> ארכוב</>}
            </Button>
          </div>
        </div>
        {t.is_safety && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" /> מפגע בטיחותי{t.equipment_disabled ? " · הציוד מושבת משימוש" : ""}
          </div>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <Info k="אחראי" v={name(t.assignee_id)} />
          <Info k="מועד יעד" v={t.due_date ? new Date(t.due_date).toLocaleDateString("he-IL") : "—"} danger={late} extra={late ? "באיחור" : undefined} />
          <Info k="מיקום" v={t.location ?? "—"} />
          <Info k="ממתין מאז" v={t.waiting_since ? fmt(t.waiting_since) : "—"} />
          <Info k="נפתח" v={`${fmt(t.created_at)} · ${name(t.created_by)}`} />
          <Info k="עדכון אחרון" v={`${fmt(t.updated_at)} · ${name(t.updated_by)}`} />
          <Info k="הושלם" v={fmt(t.completed_at)} />
          {t.next_step && <Info k="נדרש להתקדם" v={t.next_step} />}
          {t.external_party && <Info k="גורם חיצוני" v={t.external_party} />}
          {t.delay_reason && <Info k="סיבת עיכוב" v={t.delay_reason} />}
        </dl>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="flex-wrap">
          <TabsTrigger value="details">פרטים ועריכה</TabsTrigger>
          <TabsTrigger value="timeline">ציר זמן</TabsTrigger>
          <TabsTrigger value="comments">הערות</TabsTrigger>
          <TabsTrigger value="subtasks">תת־משימות</TabsTrigger>
          <TabsTrigger value="files">קבצים</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="rounded-2xl border bg-card p-5">
          <TaskForm key={t.updated_at} mode="edit" initial={toFormValues(t)} busy={busy} onSubmit={(v) => update(toPayload(v))} />
        </TabsContent>
        <TabsContent value="timeline"><Timeline taskId={id} name={name} /></TabsContent>
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

const ACTIONS: Record<string, string> = { created: "נפתחה המשימה", status_change: "שינוי סטטוס", updated: "עדכון", archived: "הועבר לארכיון", restored: "שוחזר מהארכיון" };

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
      {q.data?.map((h) => (
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
  async function add() {
    if (!body.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("task_comments").insert({ task_id: taskId, body: body.trim(), user_id: u.user!.id });
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
      <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="הוספת הערה…" />
      <Button size="sm" onClick={add}>הוספה</Button>
    </div>
  );
}

function Subtasks({ taskId }: { taskId: string }) {
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
      <ul className="divide-y">{q.data?.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
      {q.data?.length === 0 && <p className="p-5 text-sm text-muted-foreground">אין תת־משימות</p>}
      <div className="border-t p-4">
        <Button asChild size="sm" variant="outline"><Link to="/tasks/new" search={{ parent: taskId }}>+ תת־משימה</Link></Button>
      </div>
    </div>
  );
}

function Files({ taskId }: { taskId: string }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
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
          try { await uploadTaskFiles(taskId, files); setFiles([]); toast.success("הקבצים הועלו"); }
          catch { toast.error("ההעלאה נכשלה"); }
          setBusy(false);
          qc.invalidateQueries({ queryKey: ["tasks", "files", taskId] });
        }}>העלאה</Button>
      )}
    </div>
  );
}
