import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LayoutDashboard, ListTodo, Archive, Plus, LogOut, MoreHorizontal, ChevronDown, AlertTriangle, Bell, CheckCheck, BarChart3, Users, ListChecks } from "lucide-react";
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
      .channel(`tasks-live-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => qc.invalidateQueries({ queryKey: ["tasks"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_history" }, () => qc.invalidateQueries({ queryKey: ["tasks"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, () => qc.invalidateQueries({ queryKey: ["tasks"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decisions" }, () => qc.invalidateQueries({ queryKey: ["tasks"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    // Realtime is primary; reconcile only on tab return / reconnect, plus a rare visible-only safety net.
    const catchUp = () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); };
    const onVisible = () => { if (document.visibilityState === "visible") catchUp(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", catchUp);
    const timer = setInterval(() => { if (document.visibilityState === "visible") catchUp(); }, 300000);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", catchUp); supabase.removeChannel(ch); };
  }, [qc]);
}

const NAV = [
  { to: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard, search: undefined },
  { to: "/tasks", label: "כל המשימות", icon: ListTodo, search: { preset: "all" } },
  { to: "/tasks", label: "מפגעי בטיחות", icon: AlertTriangle, search: { preset: "safety" } },
  { to: "/tasks", label: "ארכיון", icon: Archive, search: { preset: "archived" } },
  { to: "/approvals", label: "אישורים והחלטות", icon: CheckCheck, search: undefined },
  { to: "/notifications", label: "התראות", icon: Bell, search: undefined },
  { to: "/reports", label: "דוחות וייצוא", icon: BarChart3, search: undefined },
] as const;

function StaffLayout() {
  useRealtime();
  const { me } = Route.useRouteContext();
  const isStaff = me.role === "staff";
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notifications=useQuery({queryKey:['notifications','unread',isStaff],queryFn:async()=>{const r=await supabase.from('notifications').select('id',{count:'exact',head:true}).is('read_at',null).not('kind','in',isStaff?'(overdue,due,safety)':'(overdue,due)');if(r.error)throw r.error;return r.count??0;}});


  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.filter(n => !['ארכיון', 'מפגעי בטיחות', 'התראות'].includes(n.label) && (!isStaff || n.to !== '/reports')).map((n) => (
        <Link
          key={n.label}
          to={n.to}
          search={(n.search?.preset === "safety" && isStaff ? { preset: "my_action" } : n.search) as never}
          onClick={() => setOpen(false)}
          activeOptions={{ includeSearch: true }}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:font-semibold"
        >
          {n.search?.preset === "safety" && isStaff ? <ListChecks className="size-4" /> : <n.icon className="size-4" />} {n.search?.preset === "safety" && isStaff ? "ממתין לפעולה שלי" : n.label}{n.to==='/notifications'&&!!notifications.data&&<span className="mr-auto text-xs">{notifications.data}</span>}
        </Link>
      ))}
      {me?.role==='super_admin'&&<Link to="/users" onClick={()=>setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent"><Users className="size-4"/>ניהול משתמשים</Link>}
      <Button variant="ghost" className="justify-start" aria-expanded={open} onClick={() => setOpen(!open)}><MoreHorizontal className="size-4"/>עוד<ChevronDown className="mr-auto size-4"/></Button>
      {open && <div className="space-y-1 border-r pr-3">{!isStaff && <><Link to="/tasks" search={{preset:isStaff?'my_action':'safety'}} className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted"><ListChecks className="size-4"/>{isStaff?'ממתין לפעולה שלי':'מפגעי בטיחות'}</Link><Link to="/tasks" search={{preset:'archived'}} className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted"><Archive className="size-4"/>ארכיון</Link></>}<Link to="/notifications" className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted"><Bell className="size-4"/>התראות</Link></div>}
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
        <Button variant="ghost" onClick={signOut} className="mt-3 flex items-center gap-2 text-xs opacity-80 hover:opacity-100">
          <LogOut className="size-3.5" /> יציאה
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 border-l bg-sidebar text-sidebar-foreground md:block">{sidebarBody}</aside>
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 md:px-8"><span className="font-display text-lg font-bold">הראי״ה</span><span className="text-sm">{me.fullName}</span></header>
        <main className="min-w-0 p-4 pb-36 md:p-8"><Outlet /></main>
      </div>
      {open && <div className="no-print fixed inset-x-3 bottom-20 z-50 rounded-xl border bg-card p-3 shadow-lg md:hidden">
        <div className="grid grid-cols-2 gap-2">{!isStaff && <><Button asChild variant="ghost"><Link to="/tasks" search={{preset:isStaff?'my_action':'safety'}} onClick={()=>setOpen(false)}><ListChecks className="size-4"/>{isStaff?'ממתין לפעולה שלי':'מפגעי בטיחות'}</Link></Button><Button asChild variant="ghost"><Link to="/tasks" search={{preset:'archived'}} onClick={()=>setOpen(false)}><Archive className="size-4"/>ארכיון</Link></Button></>}<Button asChild variant="ghost"><Link to="/notifications" onClick={()=>setOpen(false)}><Bell className="size-4"/>התראות</Link></Button>{me.role==='super_admin'&&<Button asChild variant="ghost"><Link to="/users" onClick={()=>setOpen(false)}><Users className="size-4"/>ניהול משתמשים</Link></Button>}<Button variant="ghost" onClick={signOut}><LogOut className="size-4"/>יציאה</Button></div>
      </div>}
      <nav aria-label="תפריט תחתון" className={`no-print fixed inset-x-0 bottom-0 z-40 grid h-16 ${isStaff ? "grid-cols-4" : "grid-cols-5"} border-t bg-card px-1 pb-1 md:hidden`}>
        <Link to="/dashboard" className="mobile-tab flex flex-col items-center justify-center gap-1 text-muted-foreground"><LayoutDashboard className="size-5"/><span className="text-[10px]">לוח בקרה</span></Link>
        <Link to="/tasks" search={{preset:'all'}} className="mobile-tab flex flex-col items-center justify-center gap-1 text-muted-foreground"><ListTodo className="size-5"/><span className="text-[10px]">משימות</span></Link>
        <Link to="/approvals" className="mobile-tab flex flex-col items-center justify-center gap-1 text-muted-foreground"><CheckCheck className="size-5"/><span className="text-[10px]">אישורים והחלטות</span></Link>
        {!isStaff && <Link to="/reports" className="mobile-tab flex flex-col items-center justify-center gap-1 text-muted-foreground"><BarChart3 className="size-5"/><span className="text-[10px]">דוחות</span></Link>}
        <Button variant="ghost" className="h-full flex-col gap-1 rounded-none px-1 text-muted-foreground" aria-expanded={open} onClick={()=>setOpen(!open)}><MoreHorizontal className="size-5"/><span className="text-[10px]">עוד</span></Button>
      </nav>
      <Link
        to="/tasks/new"
        aria-label="משימה חדשה"
        className="no-print fixed bottom-20 left-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
      >
        <Plus className="size-6" />
      </Link>
    </div>
  );
}
