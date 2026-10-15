import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FilePicker } from "@/components/FilePicker";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, uploadTaskFiles } from "@/lib/tasks";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({ meta: [{ title: "פתיחת קריאה – הראי״ה" }, { name: "description", content: "פתיחת קריאה מהירה" }] }),
  component: ReportPage,
});

function ReportPage() {
  const me = useQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ number: number; fileError?: boolean } | null>(null);

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  async function submit(e: import("react").FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("יש להזין כותרת");
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc("submit_report", { _title: title, _description: description });
    const row = data?.[0];
    if (error || !row) { setBusy(false); return setError("שליחת הקריאה נכשלה, נסו שוב"); }
    let fileError = false;
    try { await uploadTaskFiles(row.id, files); } catch { fileError = true; }
    setBusy(false);
    setResult({ number: row.number, fileError });
    setTitle(""); setDescription(""); setFiles([]);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div>
          <div className="font-display font-bold">הראי״ה</div>
          <div className="text-xs text-muted-foreground">{me.data ? `שלום, ${me.data.fullName}` : "…"}</div>
        </div>
        <div className="flex gap-2">
          {me.data && me.data.role !== "user" && (
            <Button asChild variant="outline" size="sm"><Link to="/dashboard">ללוח הבקרה</Link></Button>
          )}
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4" /> יציאה</Button>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        {result ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto size-14 text-success" />
            <h1 className="mt-4 text-xl font-bold">הקריאה התקבלה</h1>
            <p className="mt-2 text-muted-foreground">מספר הקריאה שלך:</p>
            <p className="mt-1 font-display text-4xl font-bold text-primary">#{result.number}</p>
            {result.fileError && <p className="mt-3 text-sm text-destructive">חלק מהקבצים לא הועלו.</p>}
            <Button className="mt-6" onClick={() => setResult(null)}>פתיחת קריאה נוספת</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-bold">פתיחת קריאה</h1>
            <div className="space-y-1.5">
              <Label htmlFor="t">כותרת *</Label>
              <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="למשל: נורה שרופה בכיתה ג׳" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d">תיאור</Label>
              <Textarea id="d" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
            </div>
            <FilePicker files={files} onChange={setFiles} />
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "שולח…" : "שליחת קריאה"}</Button>
          </form>
        )}
      </main>
    </div>
  );
}
