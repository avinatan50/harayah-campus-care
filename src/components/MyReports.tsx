import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/TaskRow";
import { formatDate, myReportsQuery, type MyReport, type ReportFile } from "@/lib/tasks";

/** Collapsible list of the calls this reporter opened themselves. */
export function MyReports({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery(myReportsQuery(userId));

  useEffect(() => {
    const ch = supabase.channel("my-reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        qc.invalidateQueries({ queryKey: ["my-reports"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border bg-card px-4 py-3 text-start font-semibold"
      >
        <span>הקריאות שלי{q.data ? ` (${q.data.length})` : ""}</span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {q.isLoading ? <p className="text-sm text-muted-foreground">טוען…</p>
            : q.error ? <p className="text-sm text-destructive">לא ניתן לטעון את רשימת הקריאות <button className="underline" onClick={() => q.refetch()}>נסו שוב</button></p>
            : !q.data?.length ? <p className="text-sm text-muted-foreground">עדיין לא פתחת קריאות.</p>
            : q.data.map((r) => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </section>
  );
}

function ReportCard({ report }: { report: MyReport }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-mono font-semibold text-primary">#{report.number}</span>
        <span>{formatDate(report.created_at)}</span>
      </div>
      <h3 className="mt-1 break-words font-semibold">{report.title}</h3>
      {report.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{report.description}</p>}
      <div className="mt-2"><StatusBadge status={report.status} /></div>
      {report.files.length > 0 && <ReportMedia files={report.files} />}
      {report.last_note && (
        <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-semibold">הערה אחרונה: </span>
          <span className="whitespace-pre-wrap">{report.last_note}</span>
        </div>
      )}
    </article>
  );
}

function ReportMedia({ files }: { files: ReportFile[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {files.map((f) => <MediaItem key={f.id} file={f} />)}
    </ul>
  );
}

function MediaItem({ file }: { file: ReportFile }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let objectUrl = "";
    (async () => {
      const signed = await supabase.storage.from("task-files").createSignedUrl(file.path, 600);
      if (!alive) return;
      if (!signed.error && signed.data?.signedUrl) { setUrl(signed.data.signedUrl); return; }
      const dl = await supabase.storage.from("task-files").download(file.path);
      if (!alive) return;
      if (dl.error || !dl.data) { setFailed(true); return; }
      objectUrl = URL.createObjectURL(dl.data);
      setUrl(objectUrl);
    })();
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.path]);

  const kind = file.mime_type ?? "";
  return (
    <li className="text-sm">
      {failed ? (
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{file.file_name}</span>
      ) : !url ? (
        <span className="flex size-20 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">…</span>
      ) : kind.startsWith("image/") ? (
        <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={file.file_name} className="size-20 rounded-md object-cover" /></a>
      ) : kind.startsWith("video/") ? (
        <video src={url} controls preload="metadata" className="h-28 rounded-md" />
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="rounded-md bg-muted px-2 py-1 text-xs underline">{file.file_name}</a>
      )}
    </li>
  );
}