import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { STATUS_OPTIONS, type Task, type TaskStatus } from '@/lib/tasks';
import { approvedAmount, resolutionDestination, resolutionStatus, type ResolutionOutcome } from '@/lib/task-resolution';

export function TaskResolution({ task }: { task: Task }) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<ResolutionOutcome>('approved');
  const [body, setBody] = useState('');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState<'' | 'task' | 'fault'>('');
  const [next, setNext] = useState<TaskStatus>('in_progress');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const decision = task.status === 'waiting_decision';
  if (task.archived || !['waiting_approval', 'waiting_decision'].includes(task.status)) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    try {
      const target = resolutionDestination(task.status, destination);
      const value = approvedAmount(amount);
      const result = await supabase.rpc('record_task_resolution', {
        _task: task.id, _outcome: outcome, _body: body.trim(),
        _next: resolutionStatus(outcome, next), _expected: task.updated_at, _key: key,
        ...(target ? { _destination: target } : {}),
        ...(value === undefined ? {} : { _amount: value }),
      });
      if (result.error) throw new Error(result.error.message.includes('CONFLICT') ? 'הסעיף השתנה. טענו את הגרסה העדכנית לפני שמירה.' : 'הפעולה לא נשמרה');
      setBody(''); setAmount(''); setKey(crypto.randomUUID());
      await Promise.all([qc.invalidateQueries({ queryKey: ['tasks'] }), qc.invalidateQueries({ queryKey: ['notifications'] })]);
      toast.success(decision ? 'ההחלטה נשמרה' : 'האישור נשמר');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'הפעולה לא נשמרה'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-3 border-y border-border py-5" aria-label={decision ? 'תיעוד החלטה' : 'תיעוד אישור'}>
    <h2 className="font-semibold">{decision ? 'תיעוד החלטה' : 'אישור הסעיף'}</h2>
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor={`outcome-${task.id}`}>תוצאת {decision ? 'ההחלטה' : 'האישור'}</Label>
          <select id={`outcome-${task.id}`} className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={outcome} disabled={busy} onChange={e => { const v = e.target.value as ResolutionOutcome; setOutcome(v); setNext(v === 'rejected' ? 'cancelled' : 'in_progress'); }}>
            <option value="approved">מאושר</option><option value="rejected">נדחה</option><option value="instruction">הנחיה אחרת</option>
          </select></div>
        {decision && <div className="space-y-1.5"><Label htmlFor={`destination-${task.id}`}>לאן להעביר לאחר ההחלטה *</Label>
          <select id={`destination-${task.id}`} required disabled={busy} className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={destination} onChange={e => setDestination(e.target.value as '' | 'task' | 'fault')}>
            <option value="">בחירת יעד…</option><option value="task">משימה</option><option value="fault">תקלה</option>
          </select></div>}
      </div>
      <div className="space-y-1.5"><Label htmlFor={`note-${task.id}`}>{decision ? 'פרטי ההחלטה / הערה' : 'הערת אישור'} *</Label>
        <Textarea id={`note-${task.id}`} rows={3} required maxLength={5000} disabled={busy} value={body} onChange={e => setBody(e.target.value)} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor={`approved-amount-${task.id}`}>סכום מאושר (₪)</Label><Input id={`approved-amount-${task.id}`} type="number" min="0" step="0.01" disabled={busy} value={amount} onChange={e => setAmount(e.target.value)} /></div>
        {outcome !== 'approved' && <div className="space-y-1.5"><Label htmlFor={`next-status-${task.id}`}>סטטוס לאחר ההחלטה</Label><select id={`next-status-${task.id}`} className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={next} disabled={busy} onChange={e => setNext(e.target.value as TaskStatus)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>}
      </div>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !body.trim() || (decision && !destination)}>{decision ? <Send className="size-4" /> : <Check className="size-4" />}{busy ? 'שומר…' : decision ? 'שמירת החלטה' : 'אישור'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => qc.invalidateQueries({ queryKey: ['tasks'] })}>טעינת גרסה עדכנית</Button></div>
    </form>
  </section>;
}