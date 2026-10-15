import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function CodeInput({ value, onChange, onComplete, autoFocus }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; autoFocus?: boolean;
}) {
  return (
    <div dir="ltr" className="flex justify-center">
      <InputOTP
        maxLength={4}
        value={value}
        onChange={(v) => onChange(v.replace(/\D/g, ""))}
        onComplete={onComplete}
        inputMode="numeric"
        pattern="^[0-9]*$"
        autoFocus={autoFocus}
        autoComplete="one-time-code"
      >
        <InputOTPGroup className="gap-3">
          {[0, 1, 2, 3].map((i) => (
            <InputOTPSlot key={i} index={i} className="h-16 w-14 rounded-lg border text-2xl font-semibold" />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: import("react").ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary font-display text-2xl font-bold text-primary-foreground">ה</div>
          <h1 className="text-2xl font-bold">הראי״ה</h1>
          <p className="text-sm text-muted-foreground">ניהול משימות ותקלות</p>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
