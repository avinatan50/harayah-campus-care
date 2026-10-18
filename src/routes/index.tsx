import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthCard, CodeInput } from "@/components/CodeInput";
import { loginWithCode } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "כניסה – הראי״ה ניהול משימות ותקלות" },
      { name: "description", content: "כניסה באמצעות קוד אישי בן 4 ספרות למערכת ניהול המשימות של תלמוד תורה הראי״ה" },
      { property: "og:title", content: "כניסה – הראי״ה ניהול משימות ותקלות" },
      { property: "og:description", content: "כניסה באמצעות קוד אישי בן 4 ספרות" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const login = useServerFn(loginWithCode);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  async function submit(v = code) {
    if (!/^\d{4}$/.test(v) || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await login({ data: { code: v } });
      if (!res.ok) { setError(res.error); setCode(""); return; }
      const { error } = await supabase.auth.setSession(res.data);
      if (error) throw error;
      navigate({ to: "/home", replace: true });
    } catch {
      setError("הכניסה נכשלה, נסו שוב");
    } finally { setBusy(false); }
  }

  return (
    <AuthCard title="כניסה" subtitle="הזינו את קוד הכניסה האישי (4 ספרות)">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5">
        <CodeInput value={code} onChange={setCode} onComplete={(v) => submit(v)} autoFocus />
        {error && <p role="alert" className="text-center text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" className="h-11 w-full text-base" disabled={busy || code.length !== 4}>
          {busy ? "מתחבר…" : "כניסה"}
        </Button>
      </form>
      <div className="mt-6 border-t pt-4 text-right text-sm">
        משתמש חדש?{" "}
        <Link to="/register" className="font-semibold text-primary underline-offset-4 hover:underline">הרשמה</Link>
      </div>
    </AuthCard>
  );
}
