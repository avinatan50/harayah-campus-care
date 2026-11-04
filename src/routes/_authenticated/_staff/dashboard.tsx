import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ListTodo, Gavel, Scale, ExternalLink, CircleCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { applyPreset, attentionPresetFor, PRESET_LABELS, type Preset } from "@/lib/tasks";
import { TaskRow } from "@/components/TaskRow";
import { pageHead } from "@/lib/metadata";

export const Route = createFileRoute("/_authenticated/_staff/dashboard")({
  head: () => pageHead("לוח בקרה", "לוח בקרה למשימות ותקלות"),
  component: Dashboard,
});

const CARDS: Preset[] = ["open", "done", "waiting_approval", "waiting_decision", "waiting_external"];

function useCount(preset: Preset, userId?: string) {
  return useQuery({
    queryKey: ["tasks", "count", preset, userId],
    queryFn: async () => {
      const { count, error } = await applyPreset(supabase.from("tasks").select("id", { count: "exact", head: true }), preset, userId);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function Dashboard() {
  const { me } = Route.useRouteContext();
  const attentionPreset = attentionPresetFor(me.role);
  const attention = useCount(attentionPreset, me.id);
  const recent = useQuery({
    queryKey: ["tasks", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("archived", false).order("updated_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold">לוח בקרה</h1>
      <Link
        to="/tasks"
        search={{ preset: attentionPreset }}
        className="flex items-center gap-3 rounded-xl border-2 border-destructive/50 bg-destructive/5 px-4 py-4 font-semibold text-destructive"
      >
        <AlertTriangle className="size-5" />
        <span>{PRESET_LABELS[attentionPreset]}:</span>
        <span className="font-display text-xl">{attention.isLoading ? "…" : attention.data}</span>
        <ChevronLeft className="mr-auto size-4" />
      </Link>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {CARDS.map((p) => <CountCard key={p} preset={p} />)}
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between pt-2">
          <h2 className="font-semibold">עודכנו לאחרונה</h2>
          <Link to="/tasks" search={{ preset: "all", sort: "updated" }} className="text-sm text-primary hover:underline">לכל המשימות</Link>
        </div>
        {recent.isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">טוען…</p>
        ) : recent.error ? (
          <p className="p-5 text-sm text-destructive">שגיאה בטעינה</p>
        ) : recent.data?.length ? (
          <ul className="grid gap-3">{recent.data.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">אין עדיין משימות. לחצו „משימה חדשה” כדי להתחיל.</p>
        )}
      </section>
    </div>
  );
}

function CountCard({ preset }: { preset: Preset }) {
  const q = useCount(preset);
  const Icon = preset === 'done' ? CircleCheck : preset === 'waiting_approval' ? Gavel : preset === 'waiting_decision' ? Scale : preset === 'waiting_external' ? ExternalLink : ListTodo;
  const tone = preset === 'done' ? 'bg-success/15 text-success' : preset === 'waiting_external' ? 'bg-external-soft text-external' : preset === 'waiting_approval' || preset === 'waiting_decision' ? 'bg-decision-soft text-decision' : 'bg-info-soft text-info';
  return (
    <Link to="/tasks" search={{ preset }} className="rounded-xl border bg-card p-4 transition hover:border-input">
      <div className="flex items-center justify-between"><span className={`flex size-10 items-center justify-center rounded-lg ${tone}`}><Icon className="size-5"/></span><span className="font-display text-2xl font-semibold">{q.isLoading ? "…" : q.error ? "!" : q.data}</span></div>
      <div className="mt-3 text-sm font-medium">{PRESET_LABELS[preset]}</div>
    </Link>
  );
}
