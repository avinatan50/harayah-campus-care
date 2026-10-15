import { Paperclip, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

export function FilePicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/*,video/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).filter((f) => f.size <= 50 * 1024 * 1024);
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
              <span className="truncate">{f.name}</span>
              <button type="button" aria-label="הסרה" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
