import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, CodeInput } from "@/components/CodeInput";
import { registerUser } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "הרשמה – הראי״ה ניהול משימות ותקלות" },
      { name: "description", content: "הרשמת משתמש חדש למערכת הדיווח של תלמוד תורה הראי״ה" },
      { property: "og:title", content: "הרשמה – הראי״ה" },
      { property: "og:description", content: "הרשמת משתמש חדש למערכת הדיווח" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const register = useServerFn(registerUser);
  const navigate = useNavigate();

  async function submit(e: import("react").FormEvent) {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) return setError("יש להזין שם מלא");
    if (!/^[0-9+\-\s]{9,15}$/.test(phone.trim())) return setError("יש להזין מספר טלפון תקין");
    if (!/^\d{4}$/.test(code)) return setError("יש להזין 4 ספרות");
    setBusy(true);
    try {
      const res = await register({ data: { fullName, phone, code } });
      if (!res.ok) { setError(res.error); return; }
      await supabase.auth.setSession(res.data);
      setDone(code);
    } catch {
      setError("ההרשמה נכשלה, נסו שוב");
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <AuthCard title="נרשמתם בהצלחה!">
        <p className="text-sm">קוד הכניסה שלכם הוא ארבע הספרות שהזנתם:</p>
        <p dir="ltr" className="my-4 text-center font-display text-4xl font-bold tracking-[0.4em] text-primary">{done}</p>
        <p className="text-sm text-muted-foreground">שמרו אותו – בכל כניסה תזינו רק את הקוד הזה.</p>
        <Button className="mt-5 h-11 w-full" onClick={() => navigate({ to: "/home", replace: true })}>המשך לפתיחת קריאה</Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="הרשמה" subtitle="כל השדות חובה">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">שם מלא</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">טלפון</Label>
          <Input id="phone" dir="ltr" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} autoComplete="tel" className="text-right" />
        </div>
        <div className="space-y-1.5">
          <Label>4 הספרות האחרונות של תעודת הזהות</Label>
          <CodeInput value={code} onChange={setCode} />
          <p className="text-xs text-muted-foreground">ספרות אלו ישמשו כקוד הכניסה שלכם.</p>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "נרשם…" : "הרשמה"}</Button>
      </form>
      <div className="mt-6 border-t pt-4 text-center text-sm">
        כבר רשומים? <Link to="/" className="font-semibold text-primary hover:underline">כניסה</Link>
      </div>
    </AuthCard>
  );
}
