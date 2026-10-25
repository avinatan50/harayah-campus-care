import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { meQuery, STATUS_LABELS, TYPE_LABELS, URGENCY_LABELS, normalizeStatus, type Task } from "@/lib/tasks";

export function StatusBadge({ status }: { status: Task["status"] }) {
  const tone =
    status === "closed" || status === "done_pending_close" || status === "approved" ? "bg-success/15 text-success"
    : status === "cancelled" ? "bg-muted text-muted-foreground"
    : status === "waiting_decision" || status === "waiting_approval" ? "bg-decision-soft text-decision"
    : status === "new" || status === "recurring_fault" ? "bg-info-soft text-info"
    : status.startsWith("waiting") || status === "paused" ? "bg-warning/25 text-warning-foreground"
    : "bg-secondary text-secondary-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{STATUS_LABELS[status]}</span>;
}

export function TaskRow({ task }: { task: Task }) {
  const { data: me } = useQuery(meQuery);
  const showSafety = task.is_safety && me?.role === "super_admin";
  return (
    <li className="task-item">
      <Link to="/tasks/$id" params={{ id: task.id }} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-4 hover:bg-muted/30">
        <span className="min-w-0 break-words font-semibold">{task.title}</span>
        <span className="font-mono text-xs text-muted-foreground">#{task.number}</span>
        <div className="col-span-2 flex flex-wrap items-center gap-2">
        {showSafety && <AlertTriangle className="size-4 text-destructive" aria-label="מפגע בטיחותי" />}
        <span className="rounded-full border border-info/30 bg-info-soft/40 px-2 py-0.5 text-xs text-info">{TYPE_LABELS[task.type]}</span>
        {task.urgency !== "normal" && (
          <span className={`text-xs font-semibold ${task.urgency === "critical" ? "text-destructive" : "text-accent-foreground"}`}>
            {URGENCY_LABELS[task.urgency]}
          </span>
        )}
        <StatusBadge status={normalizeStatus(task.status)} />
        </div>
        <span className="col-span-2 text-xs text-muted-foreground">{task.location || (task.assignee_id ? '' : 'ללא אחראי')}<span className="float-left">{new Date(task.updated_at).toLocaleDateString("he-IL")}</span></span>
      </Link>
    </li>
  );
}
