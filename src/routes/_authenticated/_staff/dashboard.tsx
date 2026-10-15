import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { applyPreset, PRESET_LABELS, type Preset } from "@/lib/tasks";
import { TaskRow } from "@/components/TaskRow";

export const Route = createFileRoute("/_authenticated/_staff/dashboard")({
  head: () => ({ meta: [{ title: "לוח בקרה – הראי״ה" }, { name: "description", content: "לוח בקרה למשימות ותקלות" }] }),
  component: Dashboard,
});

const CARDS: Preset[] = ["open", "waiting_approval", "waiting_decision", "waiting_external", "overdue", "done"];

function useCount(preset: Preset) {
  return useQuery({
    queryKey: ["tasks", "count", preset],
    queryFn: async () => {
      const { count, error } = await applyPreset(supabase.from("tasks").select("id", { count: "exact", head: true }), preset);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function Dashboard() {
  const safety = useCount("safety");
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
        search={{ preset: "safety" }}
        className={`flex items-center gap-3 rounded-xl px-4 py-2.5 font-semibold ${
          (safety.data ?? 0) > 0 ? "bg-destructive text-destructive-foreground" : "bg-success/15 text-success"
        }`}
      >
        <AlertTriangle className="size-5" />
        <span>מפגעי בטיחות פתוחים:</span>
        <span className="font-display text-xl">{safety.isLoading ? "…" : safety.data}</span>
        <ChevronLeft className="mr-auto size-4" />
      </Link>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {CARDS.map((p) => <CountCard key={p} preset={p} />)}
      </div>

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">עודכנו לאחרונה</h2>
          <Link to="/tasks" search={{ preset: "all", sort: "updated" }} className="text-sm text-primary hover:underline">לכל המשימות</Link>
        </div>
        {recent.isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">טוען…</p>
        ) : recent.error ? (
          <p className="p-5 text-sm text-destructive">שגיאה בטעינה</p>
        ) : recent.data?.length ? (
          <ul className="divide-y">{recent.data.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">אין עדיין משימות. לחצו „משימה חדשה” כדי להתחיל.</p>
        )}
      </section>
    </div>
  );
}

function CountCard({ preset }: { preset: Preset }) {
  const q = useCount(preset);
  const tone = preset === "overdue" && (q.data ?? 0) > 0 ? "text-destructive" : preset === "done" ? "text-success" : "text-primary";
  return (
    <Link to="/tasks" search={{ preset }} className="rounded-2xl border bg-card p-4 transition hover:border-primary hover:shadow-sm">
      <div className="text-sm text-muted-foreground">{PRESET_LABELS[preset]}</div>
      <div className={`mt-2 font-display text-3xl font-bold ${tone}`}>{q.isLoading ? "…" : q.error ? "!" : q.data}</div>
    </Link>
  );
}
