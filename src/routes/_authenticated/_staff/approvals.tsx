import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { TaskResolution } from '@/components/TaskResolution';
import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/QueryState';
import { supabase } from '@/integrations/supabase/client';
import { applyPreset, STATUS_LABELS, profilesQuery, type Task } from '@/lib/tasks';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/_authenticated/_staff/approvals')({head:()=>pageHead('אישורים והחלטות','בקשות הממתינות לאישור ולהחלטה ותיעוד החלטות צוות הניהול'),component:Approvals});
function Approvals(){const [filter,setFilter]=useState('all');const p=useQuery(profilesQuery);const q=useQuery({queryKey:['tasks','approvals'],queryFn:async()=>{const r=await applyPreset(supabase.from('tasks').select('*'),'my_action').order('number');if(r.error)throw r.error;return r.data;}});
 return <div className="mx-auto max-w-5xl space-y-5"><h1 className="text-2xl font-bold">אישורים והחלטות</h1><div className="flex flex-wrap gap-2">{([['all','הכול'],['waiting_approval','ממתין לאישור'],['waiting_decision','ממתין להחלטה']] as const).map(([k,v])=><Button key={k} variant={filter===k?'default':'outline'} onClick={()=>setFilter(k)}>{v}</Button>)}</div><QueryState loading={q.isLoading} error={q.error} retry={()=>q.refetch()}/>{q.data?.filter(t=>filter==='all'||t.status===filter).map(t=><Approval key={t.id} task={t} opener={p.data?.find(x=>x.id===t.created_by)?.full_name??'—'}/>)}{q.data?.filter(t=>filter==='all'||t.status===filter).length===0&&<p className="py-8 text-muted-foreground">אין בקשות ממתינות</p>}</div>;}
function Approval({task:t,opener}:{task:Task;opener:string}) {
 return <article className="space-y-3 rounded-lg border bg-card p-5">
 <div className="flex flex-wrap justify-between gap-2"><Link to="/tasks/$id" params={{id:t.id}} className="font-semibold text-primary">#{t.number} · {t.title}</Link><span className="text-sm">{STATUS_LABELS[t.status]}</span></div>
 <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">נפתח על ידי</dt><dd>{opener}</dd></div><div><dt className="text-muted-foreground">נדרש להתקדם</dt><dd>{t.next_step||t.description||'—'}</dd></div>{t.requested_amount!==null&&<div><dt className="text-muted-foreground">סכום מבוקש</dt><dd>₪{t.requested_amount.toLocaleString('he-IL')}</dd></div>}</dl>
 <TaskResolution key={t.updated_at} task={t}/></article>;
}
