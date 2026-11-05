import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "install-dismissed";

/** Friendly "add to home screen" banner: direct install on Android, instructions on iPhone. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(KEY) || window.top !== window.self) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) { setIos(true); setShow(true); }
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIP); setShow(true); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!show) return null;
  const close = () => { localStorage.setItem(KEY, "1"); setShow(false); };
  return (
    <div className="no-print fixed inset-x-3 bottom-20 z-50 flex items-start gap-3 rounded-xl border bg-card p-3 shadow-lg md:bottom-4 md:left-4 md:right-auto md:w-96">
      <img src="/icon-192.png" alt="" className="size-12 rounded-xl" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">התקנת אפליקציית הראי״ה</p>
        {ios ? <p className="text-muted-foreground">לחצו על <Share className="inline size-4" /> שיתוף ← „הוסף למסך הבית”.</p>
          : <Button size="sm" className="mt-2" onClick={async () => { await evt?.prompt(); close(); }}><Download className="size-4" />התקנה</Button>}
      </div>
      <button aria-label="סגירה" onClick={close} className="text-muted-foreground"><X className="size-4" /></button>
    </div>
  );
}
