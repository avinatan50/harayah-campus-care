import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  applyPreset, meQuery, PRESET_LABELS, profilesQuery, STATUS_LABELS, TYPE_LABELS, URGENCY_LABELS,
  type Preset, type TaskStatus, type TaskType, type TaskUrgency, todayISO,
} from "@/lib/tasks";
import { TaskRow } from "@/components/TaskRow";
import { pageHead } from "@/lib/metadata";

const presets = ["open", "waiting_approval", "waiting_decision", "waiting_external", "overdue", "done", "safety", "my_action", "archived", "all"] as const;
const searchSchema = z.object({
  preset: z.enum(presets).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  assignee: z.string().optional().catch(undefined),
  type: z.string().optional().catch(undefined),
  urgency: z.string().optional().catch(undefined),
  safety: z.boolean().optional().catch(undefined),
  due: z.enum(["overdue", "week", "none"]).optional().catch(undefined),
  sort: z.enum(["created", "updated", "due"]).optional().catch(undefined),
});
type Search = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_authenticated/_staff/tasks/")({
  validateSearch: searchSchema,
  head: () => pageHead("משימות", "רשימת משימות ותקלות"),
  component: TasksList,
});

const selectCls = "h-9 rounded-md border border-input bg-card px-2 text-sm";

function TasksList() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/tasks/" });
  const set = (patch: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const profiles = useQuery(profilesQuery);
  const { data: me } = useQuery(meQuery);
  const preset: Preset = s.preset ?? "all";

  const list = useQuery({
    queryKey: ["tasks", "list", s, me?.id],
    enabled: preset !== "my_action" || !!me?.id,
    queryFn: async () => {
      let q = applyPreset(supabase.from("tasks").select("*", { count: "exact" }), preset, me?.id);
      if (s.status) q = q.eq("status", s.status as TaskStatus);
      if (s.type) q = q.eq("type", s.type as TaskType);
      if (s.urgency) q = q.eq("urgency", s.urgency as TaskUrgency);
      if (s.assignee) q = s.assignee === "none" ? q.is("assignee_id", null) : q.eq("assignee_id", s.assignee);
      if (s.safety) q = q.eq("is_safety", true);
      if (s.due === "overdue") q = q.lt("due_date", todayISO()).not("status", "in", "(closed,cancelled)");
      if (s.due === "none") q = q.is("due_date", null);
      if (s.due === "week") {
        const w = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        q = q.gte("due_date", todayISO()).lte("due_date", w);
      }
      if (s.q?.trim()) {
        const term = s.q.trim().replace(/[%,()]/g, " ");
        const asNum = /^\d+$/.test(term) ? `,number.eq.${term}` : "";
        q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,location.ilike.%${term}%${asNum}`);
      }
      const col = s.sort === "created" ? "created_at" : s.sort === "due" ? "due_date" : "updated_at";
      q = q.order(col, { ascending: s.sort === "due", nullsFirst: false }).limit(500);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data, count: count ?? data.length };
    },
  });

  const active: { key: keyof Search; label: string }[] = [];
  if (s.q) active.push({ key: "q", label: `חיפוש: ${s.q}` });
  if (s.status) active.push({ key: "status", label: STATUS_LABELS[s.status as TaskStatus] });
  if (s.type) active.push({ key: "type", label: TYPE_LABELS[s.type as TaskType] });
  if (s.urgency) active.push({ key: "urgency", label: `דחיפות ${URGENCY_LABELS[s.urgency as TaskUrgency]}` });
  if (s.assignee) active.push({ key: "assignee", label: s.assignee === "none" ? "ללא אחראי" : `אחראי: ${profiles.data?.find((p) => p.id === s.assignee)?.full_name ?? ""}` });
  if (s.safety) active.push({ key: "safety", label: "מפגע בטיחותי" });
  if (s.due) active.push({ key: "due", label: { overdue: "באיחור", week: "יעד בשבוע הקרוב", none: "ללא מועד יעד" }[s.due] });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{PRESET_LABELS[preset]}</h1>
        <Button asChild><Link to="/tasks/new">+ משימה חדשה</Link></Button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
        <Input placeholder="חיפוש חופשי או מספר…" defaultValue={s.q} className="h-9 w-56"
          onKeyDown={(e) => { if (e.key === "Enter") set({ q: e.currentTarget.value || undefined }); }}
          onBlur={(e) => set({ q: e.currentTarget.value || undefined })} />
        <select className={selectCls} value={preset} onChange={(e) => set({ preset: e.target.value as Preset })} aria-label="תצוגה">
          {presets.map((p) => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}
        </select>
        <select className={selectCls} value={s.status ?? ""} onChange={(e) => set({ status: e.target.value || undefined })} aria-label="סטטוס">
          <option value="">כל הסטטוסים</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={selectCls} value={s.type ?? ""} onChange={(e) => set({ type: e.target.value || undefined })} aria-label="סוג">
          <option value="">כל הסוגים</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={selectCls} value={s.urgency ?? ""} onChange={(e) => set({ urgency: e.target.value || undefined })} aria-label="דחיפות">
          <option value="">כל הדחיפויות</option>
          {Object.entries(URGENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={selectCls} value={s.assignee ?? ""} onChange={(e) => set({ assignee: e.target.value || undefined })} aria-label="אחראי">
          <option value="">כל האחראים</option>
          <option value="none">ללא אחראי</option>
          {profiles.data?.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <select className={selectCls} value={s.due ?? ""} onChange={(e) => set({ due: (e.target.value || undefined) as Search["due"] })} aria-label="מועד יעד">
          <option value="">כל מועדי היעד</option>
          <option value="overdue">באיחור</option>
          <option value="week">בשבוע הקרוב</option>
          <option value="none">ללא מועד</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={!!s.safety} onChange={(e) => set({ safety: e.target.checked || undefined })} /> מפגע בטיחותי
        </label>
        <select className={selectCls} value={s.sort ?? "updated"} onChange={(e) => set({ sort: e.target.value as Search["sort"] })} aria-label="מיון">
          <option value="updated">מיון: עדכון אחרון</option>
          <option value="created">מיון: תאריך פתיחה</option>
          <option value="due">מיון: מועד יעד</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{list.data ? `${list.data.count} תוצאות` : "…"}</span>
        {active.map((a) => (
          <button key={a.key} onClick={() => set({ [a.key]: undefined })} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground">
            {a.label} <X className="size-3" />
          </button>
        ))}
        {active.length > 0 && (
          <button className="text-primary hover:underline" onClick={() => navigate({ search: { preset: s.preset }, replace: true })}>ניקוי מסננים</button>
        )}
      </div>

      <div className="rounded-2xl border bg-card">
        {list.isLoading ? <p className="p-5 text-sm text-muted-foreground">טוען…</p>
          : list.error ? <p className="p-5 text-sm text-destructive">שגיאה בטעינה <button className="underline" onClick={() => list.refetch()}>נסו שוב</button></p>
          : !list.data?.rows.length ? <p className="p-5 text-sm text-muted-foreground">לא נמצאו משימות.</p>
          : <ul className="divide-y">{list.data.rows.map((t) => <TaskRow key={t.id} task={t} />)}</ul>}
      </div>
    </div>
  );
}
