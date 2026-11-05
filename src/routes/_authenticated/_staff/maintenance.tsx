import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, MapPin, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { QueryState } from "@/components/QueryState";
import { supabase } from "@/integrations/supabase/client";
import { locationPath, locationsQuery, type LocationNode } from "@/lib/tasks";
import { currentCycleStart, nextCycleStart, progress, INTERVAL_LABELS } from "@/lib/maintenance";
import { pageHead } from "@/lib/metadata";

export const Route = createFileRoute("/_authenticated/_staff/maintenance")({
  beforeLoad: ({ context }) => { if (context.me.role !== "super_admin") throw redirect({ to: "/dashboard", replace: true }); },
  head: () => pageHead("ביקורות ותחזוקה מונעת", "משימות תקופתיות פרטיות למנהל הראשי"),
  component: MaintenancePage,
});

const routinesQuery = {
  queryKey: ["maintenance"],
  queryFn: async () => {
    const [r, rl, c] = await Promise.all([
      supabase.from("maintenance_routines").select("*").order("created_at"),
      supabase.from("maintenance_routine_locations").select("routine_id,location_id"),
      supabase.from("maintenance_checks").select("id,routine_id,location_id,cycle_start,checked_at"),
    ]);
    if (r.error || rl.error || c.error) throw new Error("טעינת המשימות התקופתיות נכשלה");
    return { routines: r.data, links: rl.data, checks: c.data };
  },
};

function fmt(d: string) { return new Date(d + "T00:00:00Z").toLocaleDateString("he-IL", { timeZone: "UTC" }); }

function MaintenancePage() {
  const q = useQuery(routinesQuery);
  const locs = useQuery(locationsQuery);
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", interval: 1 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["maintenance"] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const { error } = await supabase.from("maintenance_routines").insert({ title: form.title.trim(), description: form.description.trim() || null, interval_months: form.interval });
    if (error) return toast.error("השמירה נכשלה");
    setForm({ title: "", description: "", interval: 1 }); setAdding(false); refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">ביקורות ותחזוקה מונעת</h1><p className="text-sm text-muted-foreground">גלוי רק לך. סמנו V על המיקומים שנבדקו – אפשר להשלים בהדרגה לפי ההספק.</p></div>
        <Button onClick={() => setAdding(!adding)}><Plus className="size-4" />משימה תקופתית</Button>
      </div>
      {adding && <form onSubmit={add} className="space-y-3 rounded-xl border bg-card p-4">
        <Input placeholder="שם המשימה" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
        <Textarea placeholder="מה בודקים (אופציונלי)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
        <label className="flex items-center gap-2 text-sm">תדירות:
          <select className="rounded-md border bg-background p-2" value={form.interval} onChange={(e) => setForm({ ...form, interval: Number(e.target.value) })}>
            {[1, 2, 3, 4, 6, 12, 24].map((n) => <option key={n} value={n}>{INTERVAL_LABELS[n] ?? `כל ${n} חודשים`}</option>)}
          </select></label>
        <Button type="submit">שמירה</Button>
      </form>}
      <QueryState loading={q.isLoading || locs.isLoading} error={q.error ?? locs.error} retry={() => q.refetch()} />
      {q.data && locs.data && q.data.routines.map((r) => <RoutineCard key={r.id} routine={r} locs={locs.data} links={q.data.links.filter((l) => l.routine_id === r.id).map((l) => l.location_id)} checks={q.data.checks.filter((c) => c.routine_id === r.id)} onChange={refresh} />)}
      {q.data?.routines.length === 0 && <p className="text-muted-foreground">אין משימות תקופתיות עדיין.</p>}
    </div>
  );
}

type Routine = { id: string; title: string; description: string | null; interval_months: number; anchor_date: string; active: boolean };
type CheckRow = { id: string; location_id: string; cycle_start: string; checked_at: string };

function RoutineCard({ routine, locs, links, checks, onChange }: { routine: Routine; locs: LocationNode[]; links: string[]; checks: CheckRow[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [editLocs, setEditLocs] = useState(false);
  const [busy, setBusy] = useState(false);
  const cycle = currentCycleStart(routine.anchor_date, routine.interval_months);
  const cycleChecks = checks.filter((c) => c.cycle_start === cycle);
  const done = links.filter((id) => cycleChecks.some((c) => c.location_id === id)).length;
  const pct = progress(done, links.length);
  const sorted = [...links].sort((a, b) => locationPath(locs, a).localeCompare(locationPath(locs, b), "he"));

  async function toggleCheck(locId: string) {
    setBusy(true);
    const existing = cycleChecks.find((c) => c.location_id === locId);
    const { error } = existing
      ? await supabase.from("maintenance_checks").delete().eq("id", existing.id)
      : await supabase.from("maintenance_checks").insert({ routine_id: routine.id, location_id: locId, cycle_start: cycle });
    setBusy(false);
    if (error) toast.error("העדכון נכשל"); else onChange();
  }
  async function toggleLink(locId: string) {
    const { error } = links.includes(locId)
      ? await supabase.from("maintenance_routine_locations").delete().eq("routine_id", routine.id).eq("location_id", locId)
      : await supabase.from("maintenance_routine_locations").insert({ routine_id: routine.id, location_id: locId });
    if (error) toast.error("העדכון נכשל"); else onChange();
  }
  async function remove() {
    if (!confirm(`למחוק את „${routine.title}” וכל היסטוריית הבדיקות שלה?`)) return;
    const { error } = await supabase.from("maintenance_routines").delete().eq("id", routine.id);
    if (error) toast.error("המחיקה נכשלה"); else onChange();
  }
  async function toTask() {
    const remaining = sorted.filter((id) => !cycleChecks.some((c) => c.location_id === id));
    if (!remaining.length) return toast.info("כל המיקומים כבר נבדקו בסבב הזה");
    if (!confirm("ליצור משימה רגילה (גלויה לצוות) עבור המיקומים שנותרו?")) return;
    const { error } = await supabase.from("tasks").insert({ title: routine.title, type: "task", description: `${routine.description ?? ""}\n\nמיקומים שנותרו:\n${remaining.map((id) => "• " + locationPath(locs, id)).join("\n")}`.trim() });
    if (error) toast.error("יצירת המשימה נכשלה"); else toast.success("נוצרה משימה רגילה לצוות");
  }

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <button className="flex w-full items-start justify-between gap-3 text-start" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{routine.title}</h2>
          <p className="text-xs text-muted-foreground">{INTERVAL_LABELS[routine.interval_months] ?? `כל ${routine.interval_months} חודשים`} · סבב נוכחי {fmt(cycle)}–{fmt(nextCycleStart(cycle, routine.interval_months))}</p>
          <div className="mt-2 flex items-center gap-3"><Progress value={pct} className="h-2 flex-1" /><span className="text-sm font-semibold">{done}/{links.length} ({pct}%)</span></div>
        </div>
        <ChevronDown className={`mt-1 size-5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-4 space-y-3 border-t pt-3">
        {routine.description && <p className="text-sm">{routine.description}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditLocs(!editLocs)}><MapPin className="size-4" />{editLocs ? "סיום בחירת מיקומים" : "בחירת מיקומים"}</Button>
          <Button size="sm" variant="outline" onClick={toTask}><Send className="size-4" />העבר את הנותרים כמשימה לצוות</Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={remove}><Trash2 className="size-4" />מחיקה</Button>
        </div>
        {editLocs ? <ul className="grid gap-1 sm:grid-cols-2">{[...locs].sort((a, b) => locationPath(locs, a.id).localeCompare(locationPath(locs, b.id), "he")).map((l) =>
          <li key={l.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={links.includes(l.id)} onChange={() => toggleLink(l.id)} />{locationPath(locs, l.id)}</label></li>)}</ul>
          : <ul className="divide-y">{sorted.map((id) => { const c = cycleChecks.find((x) => x.location_id === id); return (
            <li key={id} className="flex items-center justify-between gap-2 py-2">
              <button disabled={busy} onClick={() => toggleCheck(id)} className="flex items-center gap-3 text-start text-sm">
                <span className={`flex size-6 items-center justify-center rounded-md border ${c ? "border-success bg-success text-success-foreground" : ""}`}>{c && <Check className="size-4" />}</span>
                <span className={c ? "text-muted-foreground line-through" : ""}>{locationPath(locs, id)}</span>
              </button>
              {c && <span className="text-xs text-muted-foreground">{new Date(c.checked_at).toLocaleDateString("he-IL")}</span>}
            </li>); })}
            {sorted.length === 0 && <li className="py-2 text-sm text-muted-foreground">לא נבחרו מיקומים. לחצו „בחירת מיקומים”.</li>}</ul>}
      </div>}
    </section>
  );
}
