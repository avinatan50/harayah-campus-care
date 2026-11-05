import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push-client";

const HINT: Partial<Record<PushState, string>> = {
  iframe: "כדי להפעיל התראות יש לפתוח את האתר בלשונית נפרדת או באפליקציה המותקנת.",
  "ios-install": "באייפון: לחצו על כפתור השיתוף ← „הוסף למסך הבית”, ופתחו את האפליקציה משם כדי להפעיל התראות.",
  unsupported: "הדפדפן הזה לא תומך בהתראות לנייד.",
  denied: "ההתראות חסומות בהגדרות הדפדפן. יש לאפשר התראות לאתר בהגדרות האתר.",
};

export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setState).catch(() => setState("unsupported")); }, []);
  if (!state) return null;
  async function toggle() {
    setBusy(true);
    try {
      if (state === "on") { await disablePush(); setState("off"); toast.success("ההתראות במכשיר הזה כובו"); }
      else { const s = await enablePush(); setState(s); if (s === "on") toast.success("ההתראות הופעלו במכשיר הזה"); }
    } catch { toast.error("הפעלת ההתראות נכשלה, נסו שוב"); }
    setBusy(false);
  }
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">{state === "on" ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4" />}התראות לנייד במכשיר הזה</span>
        {(state === "on" || state === "off") && <Button size="sm" variant={state === "on" ? "outline" : "default"} disabled={busy} onClick={toggle}>{state === "on" ? "כיבוי" : "הפעלה"}</Button>}
      </div>
      {HINT[state] && <p className="text-muted-foreground">{HINT[state]}</p>}
    </div>
  );
}
