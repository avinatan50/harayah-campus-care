import { Paperclip, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function FilePicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const previews = useMemo(() => files.map(f => f.type.startsWith("image/") ? URL.createObjectURL(f) : ""), [files]);
  useEffect(() => () => previews.forEach(u => u && URL.revokeObjectURL(u)), [previews]);
  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/*,video/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const all = Array.from(e.target.files ?? []);
          const picked = all.filter((f) => f.size <= 50 * 1024 * 1024);
          setError(all.length !== picked.length ? "קובץ אחד או יותר גדול מ־50MB ולא צורף" : "");
          onChange([...files, ...picked]);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" onClick={() => ref.current?.click()}>
        <Paperclip className="size-4" /> צירוף תמונות / וידאו / קבצים
      </Button>
      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5">
              <span className="flex min-w-0 items-center gap-2">{previews[i] && <img src={previews[i]} alt="" className="size-10 rounded object-cover" />}<span className="truncate">{f.name}</span></span>
              <button type="button" aria-label="הסרה" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
