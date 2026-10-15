import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LayoutDashboard, ListTodo, Archive, Plus, LogOut, Menu, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, ROLE_LABELS } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/_staff")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery);
    if (!me.active) throw new Error("החשבון חסום. פנו למנהל הראשי.");
    if (me.role === "user") throw redirect({ to: "/report", replace: true });
    return { me };
  },
  pendingComponent: () => <div className="flex min-h-screen items-center justify-center text-muted-foreground">טוען הרשאות…</div>,
  component: StaffLayout,
});

function useRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("tasks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => qc.invalidateQueries({ queryKey: ["tasks"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_history" }, () => qc.invalidateQueries({ queryKey: ["tasks"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, () => qc.invalidateQueries({ queryKey: ["tasks"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}

const NAV = [
  { to: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard, search: undefined },
  { to: "/tasks", label: "כל המשימות", icon: ListTodo, search: { preset: "all" } },
  { to: "/tasks", label: "מפגעי בטיחות", icon: AlertTriangle, search: { preset: "safety" } },
  { to: "/tasks", label: "ארכיון", icon: Archive, search: { preset: "archived" } },
] as const;

function StaffLayout() {
  useRealtime();
  const { data: me } = useQuery(meQuery);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => (
        <Link
          key={n.label}
          to={n.to}
          search={n.search as never}
          onClick={() => setOpen(false)}
          activeOptions={{ includeSearch: true }}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:font-semibold"
        >
          <n.icon className="size-4" /> {n.label}
        </Link>
      ))}
    </nav>
  );

  const sidebarBody = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div>
        <div className="font-display text-xl font-bold text-sidebar-primary">הראי״ה</div>
        <div className="text-xs opacity-70">ניהול משימות ותקלות</div>
      </div>
      <Button asChild className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
        <Link to="/tasks/new" onClick={() => setOpen(false)}><Plus className="size-4" /> משימה חדשה</Link>
      </Button>
      {nav}
      <div className="mt-auto border-t border-sidebar-border pt-4 text-sm">
        <div className="font-semibold">{me?.fullName}</div>
        <div className="text-xs opacity-70">{me ? ROLE_LABELS[me.role] : ""}</div>
        <button onClick={signOut} className="mt-3 flex items-center gap-2 text-xs opacity-80 hover:opacity-100">
          <LogOut className="size-3.5" /> יציאה
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 bg-sidebar text-sidebar-foreground md:block">{sidebarBody}</aside>
      <div className="flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <span className="font-display font-bold text-sidebar-primary">הראי״ה</span>
        <button aria-label="תפריט" onClick={() => setOpen(true)}><Menu /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-64 bg-sidebar text-sidebar-foreground">
            <button aria-label="סגירה" className="absolute left-3 top-3" onClick={() => setOpen(false)}><X /></button>
            {sidebarBody}
          </aside>
        </div>
      )}
      <main className="min-w-0 flex-1 p-4 md:p-8"><Outlet /></main>
      <Link
        to="/tasks/new"
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg md:hidden"
      >
        <Plus className="size-5" /> משימה חדשה
      </Link>
    </div>
  );
}
