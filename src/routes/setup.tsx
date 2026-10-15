import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, CodeInput } from "@/components/CodeInput";
import { setupAdminAccount } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "הגדרה ראשונית – הראי״ה" },
      { name: "description", content: "הגדרת קודי כניסה לצוות הניהול" },
      { property: "og:title", content: "הגדרה ראשונית – הראי״ה" },
      { property: "og:description", content: "הגדרת קודי כניסה לצוות הניהול" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const [setupKey, setSetupKey] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setup = useServerFn(setupAdminAccount);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = await setup({ data: { setupKey, email, code } });
      if (!res.ok) { setError(res.error); return; }
      await supabase.auth.setSession(res.data);
      navigate({ to: "/home", replace: true });
    } catch {
      setError("בדקו את הפרטים ונסו שוב");
    } finally { setBusy(false); }
  }

  return (
    <AuthCard title="הגדרה ראשונית לצוות הניהול" subtitle="חד־פעמי לכל חשבון ניהול. נדרש מפתח ההגדרה.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="key">מפתח הגדרה</Label>
          <Input id="key" type="password" dir="ltr" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">אימייל החשבון</Label>
          <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>קוד כניסה חדש (4 ספרות)</Label>
          <CodeInput value={code} onChange={setCode} />
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" className="h-11 w-full" disabled={busy || code.length !== 4}>{busy ? "שומר…" : "הגדרה וכניסה"}</Button>
      </form>
    </AuthCard>
  );
}
