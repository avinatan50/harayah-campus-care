import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { STATUS_LABELS, TYPE_LABELS, URGENCY_LABELS, type Task } from "@/lib/tasks";

export function StatusBadge({ status }: { status: Task["status"] }) {
  const tone =
    status === "closed" ? "bg-success/15 text-success"
    : status === "cancelled" ? "bg-muted text-muted-foreground"
    : status === "recurring_fault" ? "bg-destructive/15 text-destructive"
    : status.startsWith("waiting") || status === "paused" ? "bg-warning/25 text-warning-foreground"
    : "bg-secondary text-secondary-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{STATUS_LABELS[status]}</span>;
}

export function TaskRow({ task }: { task: Task }) {
  return (
    <li>
      <Link to="/tasks/$id" params={{ id: task.id }} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-muted/60">
        <span className="font-mono text-xs text-muted-foreground">#{task.number}</span>
        {task.is_safety && <AlertTriangle className="size-4 text-destructive" aria-label="מפגע בטיחותי" />}
        <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
        <span className="text-xs text-muted-foreground">{TYPE_LABELS[task.type]}</span>
        {task.urgency !== "normal" && (
          <span className={`text-xs font-semibold ${task.urgency === "critical" ? "text-destructive" : "text-accent-foreground"}`}>
            {URGENCY_LABELS[task.urgency]}
          </span>
        )}
        <StatusBadge status={task.status} />
        {late && (
          <span className="text-xs font-semibold text-destructive">
            באיחור{task.delay_reason ? ` · ${task.delay_reason}` : task.next_step ? ` · ${task.next_step}` : ""}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{new Date(task.updated_at).toLocaleDateString("he-IL")}</span>
      </Link>
    </li>
  );
}
