import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FilePicker } from "@/components/FilePicker";
import {
  locationsQuery, profilesQuery, STATUS_LABELS, TYPE_LABELS, URGENCY_LABELS,
  type Task, type TaskStatus, type TaskType, type TaskUrgency,
} from "@/lib/tasks";

export type TaskFormValues = {
  title: string; description: string; type: TaskType; status: TaskStatus | ""; urgency: TaskUrgency;
  assignee_id: string; due_date: string; location: string; is_safety: boolean; equipment_disabled: boolean;
  next_step: string; external_party: string; delay_reason: string; delay_impact: string; requested_amount: string;
  repair_notes: string; safety_check: string; related_task_id: string;
};

export function toFormValues(t?: Task): TaskFormValues {
  return {
    title: t?.title ?? "", description: t?.description ?? "", type: t?.type ?? "task",
    status: t?.status ?? "", urgency: t?.urgency ?? "normal", assignee_id: t?.assignee_id ?? "",
    due_date: t?.due_date ?? "", location: t?.location ?? "", is_safety: t?.is_safety ?? false,
    equipment_disabled: t?.equipment_disabled ?? false, next_step: t?.next_step ?? "",
    external_party: t?.external_party ?? "", delay_reason: t?.delay_reason ?? "",
    delay_impact: t?.delay_impact ?? "", requested_amount: t?.requested_amount?.toString() ?? "",
    repair_notes:t?.repair_notes??'',safety_check:t?.safety_check??'',related_task_id:t?.related_task_id??'',
  };
}

const n = (v: string) => (v.trim() === "" ? null : v.trim());
export function toPayload(v: TaskFormValues) {
  return {
    title: v.title.trim(), description: n(v.description), type: v.type, urgency: v.urgency,
    assignee_id: v.assignee_id || null, due_date: v.due_date || null, location: n(v.location),
    is_safety: v.is_safety, equipment_disabled: v.is_safety ? v.equipment_disabled : false,
    next_step: n(v.next_step), external_party: n(v.external_party), delay_reason: n(v.delay_reason),
    delay_impact: n(v.delay_impact), requested_amount: v.requested_amount ? Number(v.requested_amount) : null,
    repair_notes:n(v.repair_notes),safety_check:n(v.safety_check),related_task_id:v.related_task_id||null,
    ...(v.status?{explicit_status:true}:{}),
    ...(v.status ? { status: v.status as TaskStatus } : {}),
  };
}

const selectCls = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm";

export function TaskForm({ initial, mode, onSubmit, busy }: {
  initial: TaskFormValues; mode: "create" | "edit"; busy?: boolean;
  onSubmit: (v: TaskFormValues, files: File[]) => void;
}) {
  const [v, setV] = useState(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [advanced, setAdvanced] = useState(mode === "edit");
  const [error, setError] = useState<string | null>(null);
  const profiles = useQuery(profilesQuery);
  const locations = useQuery(locationsQuery);
  const past=useQuery({queryKey:['tasks','completed-options'],queryFn:async()=>{const {supabase}=await import('@/integrations/supabase/client');const r=await supabase.from('tasks').select('id,number,title').not('completed_at','is',null).order('completed_at',{ascending:false}).limit(500);if(r.error)throw r.error;return r.data;}});
  const upd = <K extends keyof TaskFormValues>(k: K, val: TaskFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const defaultStatusHint =
    v.type === "request" ? STATUS_LABELS.waiting_approval : v.type === "decision" ? STATUS_LABELS.waiting_decision : STATUS_LABELS.new;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.title.trim()) return setError("יש להזין כותרת");
    if (v.requested_amount && isNaN(Number(v.requested_amount))) return setError("סכום לא תקין");
    if(v.requested_amount&&Number(v.requested_amount)<0)return setError('הסכום חייב להיות אפס או יותר');
    if(initial.equipment_disabled&&(!v.equipment_disabled||!v.is_safety)&&(!v.repair_notes.trim()||!v.safety_check.trim()||v.safety_check===initial.safety_check))return setError('לפני החזרת הציוד לשימוש נדרשים תיעוד תיקון ובדיקת תקינות חדשה');
    setError(null);
    onSubmit(v, files);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="space-y-1.5">
          <Label htmlFor="title">כותרת *</Label>
          <Input id="title" value={v.title} onChange={(e) => upd("title", e.target.value)} maxLength={200} autoFocus={mode === "create"} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">סוג *</Label>
          <select id="type" className={selectCls} value={v.type} onChange={(e) => upd("type", e.target.value as TaskType)}>
            {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="desc">תיאור</Label>
        <Textarea id="desc" rows={3} value={v.description} onChange={(e) => upd("description", e.target.value)} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="status">סטטוס</Label>
          <select id="status" className={selectCls} value={v.status} onChange={(e) => upd("status", e.target.value as TaskStatus | "")}>
            {mode === "create" && <option value="">ברירת מחדל ({defaultStatusHint})</option>}
            {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="urg">דחיפות</Label>
          <select id="urg" className={selectCls} value={v.urgency} onChange={(e) => upd("urgency", e.target.value as TaskUrgency)}>
            {Object.entries(URGENCY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="asg">אחראי לביצוע</Label>
          <select id="asg" className={selectCls} value={v.assignee_id} onChange={(e) => upd("assignee_id", e.target.value)}>
            <option value="">ללא</option>
            {profiles.data?.filter((p) => p.active || p.id === v.assignee_id).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium">
        <input type="checkbox" checked={v.is_safety} onChange={(e) => upd("is_safety", e.target.checked)} /> מפגע בטיחותי
        {v.is_safety && (
          <span className="mr-4 flex items-center gap-2 font-normal">
            <input type="checkbox" checked={v.equipment_disabled} onChange={(e) => upd("equipment_disabled", e.target.checked)} /> הציוד מושבת משימוש
          </span>
        )}
      </label>
      {(v.is_safety||initial.equipment_disabled)&&<div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="repair">תיעוד תיקון</Label><Textarea id="repair" maxLength={5000} value={v.repair_notes} onChange={e=>upd('repair_notes',e.target.value)}/></div><div><Label htmlFor="safety-check">בדיקת תקינות לפני החזרה לשימוש</Label><Textarea id="safety-check" maxLength={5000} value={v.safety_check} onChange={e=>upd('safety_check',e.target.value)}/></div></div>}

      <Collapsible open={advanced} onOpenChange={setAdvanced}>
        <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-primary">
          פרטים מתקדמים <ChevronDown className={`size-4 transition ${advanced ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2"><Label htmlFor="related-task">תקלה לאחר ביצוע — משימה מקורית</Label><select id="related-task" className={selectCls} value={v.related_task_id} onChange={e=>{upd('related_task_id',e.target.value);if(mode==='create'&&e.target.value){upd('type','fault');upd('status','recurring_fault');}}}><option value="">ללא קישור</option>{past.data?.map(t=><option key={t.id} value={t.id}>#{t.number} {t.title}</option>)}</select></div>
          <div className="space-y-1.5">
            <Label htmlFor="due">מועד יעד</Label>
            <Input id="due" type="date" value={v.due_date} onChange={(e) => upd("due_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc">מיקום במוסד</Label>
            <Input id="loc" list="locs" value={v.location} onChange={(e) => upd("location", e.target.value)} />
            <datalist id="locs">{locations.data?.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="next">מה נדרש כדי להתקדם</Label>
            <Input id="next" value={v.next_step} onChange={(e) => upd("next_step", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ext">גורם חיצוני (למי ממתינים)</Label>
            <Input id="ext" value={v.external_party} onChange={(e) => upd("external_party", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amt">סכום מבוקש (₪)</Label>
            <Input id="amt" inputMode="decimal" dir="ltr" value={v.requested_amount} onChange={(e) => upd("requested_amount", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dr">סיבת עיכוב</Label>
            <Input id="dr" value={v.delay_reason} onChange={(e) => upd("delay_reason", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="di">השלכות העיכוב</Label>
            <Input id="di" value={v.delay_impact} onChange={(e) => upd("delay_impact", e.target.value)} />
          </div>
          {mode === "create" && <div className="md:col-span-2"><FilePicker files={files} onChange={setFiles} /></div>}
        </CollapsibleContent>
      </Collapsible>

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" className="h-11 px-8" disabled={busy}>{busy ? "שומר…" : mode === "create" ? "יצירת משימה" : "שמירת שינויים"}</Button>
    </form>
  );
}
