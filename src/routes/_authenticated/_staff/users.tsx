import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CodeInput } from '@/components/CodeInput';
import { QueryState } from '@/components/QueryState';
import { listUsers, saveUser } from '@/lib/users.functions';
import { meQuery, ROLE_LABELS, type AppRole } from '@/lib/tasks';
import { supabase } from '@/integrations/supabase/client';
import { pageHead } from '@/lib/metadata';
import { EASY_CODE_MESSAGE, isEasyCode } from '@/lib/access-code';

export const Route = createFileRoute('/_authenticated/_staff/users')({ head:()=>pageHead('ניהול משתמשים ומיקומים','ניהול חשבונות, קודי כניסה, תפקידים ומיקומים במוסד'), component:Users });
type Edit = {id:string;name:string;phone:string;email:string;role:AppRole;active:boolean;code:string;create:boolean};
function Users(){
 const me=useQuery(meQuery); const load=useServerFn(listUsers); const save=useServerFn(saveUser); const qc=useQueryClient();
 const users=useQuery({queryKey:['users'],queryFn:()=>load(),enabled:me.data?.role==='super_admin'});
 const [search,setSearch]=useState(''); const [edit,setEdit]=useState<Edit|null>(null); const [busy,setBusy]=useState(false);
 if(me.data?.role!=='super_admin') return <p role="alert">המסך זמין למנהל הראשי בלבד.</p>;
 const rows=users.data?.filter(p=>`${p.full_name} ${p.phone??''}`.includes(search));
 return <div className="mx-auto max-w-5xl space-y-6"><div className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-bold">ניהול משתמשים</h1><Button onClick={()=>setEdit({id:crypto.randomUUID(),name:'',phone:'',email:'',role:'user',active:true,code:'',create:true})}>+ משתמש חדש</Button></div>
 <Input aria-label="חיפוש משתמשים" placeholder="חיפוש לפי שם או טלפון" value={search} onChange={e=>setSearch(e.target.value)}/>
 <QueryState loading={users.isLoading} error={users.error} retry={()=>users.refetch()}/>
 {!users.isLoading&&!users.error&&<ul className="divide-y border-y">{rows?.map(p=><li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong>{p.full_name}</strong><p className="text-sm text-muted-foreground">{ROLE_LABELS[p.role]} · {p.active?'פעיל':'חסום'} · {p.phone||'ללא טלפון'}</p><p className="text-xs text-muted-foreground">נרשם: {new Date(p.created_at).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'})} · {p.email||'ללא אימייל'}</p></div><Button variant="outline" onClick={()=>setEdit({id:p.id,name:p.full_name,phone:p.phone??'',email:p.email??'',role:p.role,active:p.active,code:'',create:false})}>עריכה</Button></li>)}</ul>}
 {rows?.length===0&&<p>לא נמצאו משתמשים</p>}
 {edit&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"><section role="dialog" aria-modal="true" aria-label="עריכת משתמש" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6"><h2 className="mb-4 text-xl font-bold">{edit.create?'משתמש חדש':'עריכת משתמש'}</h2><form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(busy)return;if(edit.code&&isEasyCode(edit.code)){toast.error(EASY_CODE_MESSAGE);return;}setBusy(true);try{const r=await save({data:edit});if(!r.ok){toast.error(r.error);return;}setEdit(null);await qc.invalidateQueries({queryKey:['users']});await qc.invalidateQueries({queryKey:['profiles']});toast.success('פרטי המשתמש נשמרו');}catch{toast.error('השמירה נכשלה');}finally{setBusy(false);}}}>
 {(['name','phone','email'] as const).map((k)=><div key={k}><Label htmlFor={`user-${k}`}>{({name:'שם מלא',phone:'טלפון',email:'אימייל'})[k]}</Label><Input id={`user-${k}`} type={k==='email'?'email':k==='phone'?'tel':'text'} required={k==='name'} minLength={k==='name'?2:undefined} maxLength={k==='name'?100:k==='phone'?15:255} value={edit[k]} onChange={e=>setEdit({...edit,[k]:e.target.value})}/></div>)}
 <div><Label htmlFor="user-role">תפקיד</Label><select id="user-role" className="h-10 w-full rounded-md border bg-card px-3" value={edit.role} onChange={e=>setEdit({...edit,role:e.target.value as AppRole})}>{Object.entries(ROLE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
 <label className="flex items-center gap-2"><input type="checkbox" checked={edit.active} onChange={e=>setEdit({...edit,active:e.target.checked})}/>חשבון פעיל</label>
 <div><Label>{edit.create?'קוד כניסה (4 ספרות)':'החלפת קוד (ריק = ללא שינוי)'}</Label><CodeInput value={edit.code} onChange={code=>setEdit({...edit,code})}/></div><div className="flex gap-2"><Button disabled={busy||(edit.create&&edit.code.length!==4)}>{busy?'שומר…':'שמירה'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setEdit(null)}>ביטול</Button></div></form></section></div>}
 <Locations/><Audit/>
 </div>;
}
function Locations(){const qc=useQueryClient();const [name,setName]=useState('');const q=useQuery({queryKey:['locations','manage'],queryFn:async()=>{const r=await supabase.from('locations').select('id,name').order('name');if(r.error)throw r.error;return r.data;}});async function change(id:string|undefined,newName:string){const r=id?(newName?await supabase.from('locations').update({name:newName}).eq('id',id):await supabase.from('locations').delete().eq('id',id)):await supabase.from('locations').insert({name:newName});if(r.error)toast.error('עדכון המיקום נכשל');else{setName('');qc.invalidateQueries({queryKey:['locations']});}}
 return <section className="space-y-3 border-t pt-6"><h2 className="text-xl font-bold">מיקומים במוסד</h2><QueryState loading={q.isLoading} error={q.error} retry={()=>q.refetch()}/><form className="flex gap-2" onSubmit={e=>{e.preventDefault();if(name.trim())change(undefined,name.trim());}}><Input aria-label="מיקום חדש" value={name} maxLength={100} onChange={e=>setName(e.target.value)}/><Button disabled={!name.trim()}>הוספה</Button></form><ul className="divide-y">{q.data?.map(l=><Location key={l.id} location={l} change={change}/>)}</ul></section>;}
function Location({location,change}:{location:{id:string;name:string};change:(id:string,name:string)=>unknown}){const [value,setValue]=useState(location.name);return <li className="flex flex-wrap gap-2 py-2"><Input className="w-60 max-w-full" aria-label={`מיקום ${location.name}`} value={value} onChange={e=>setValue(e.target.value)}/><Button variant="outline" disabled={!value.trim()||value===location.name} onClick={()=>change(location.id,value.trim())}>שמירה</Button><Button variant="ghost" onClick={()=>{if(confirm('להסיר את המיקום מהרשימה? משימות קיימות לא ישתנו.'))change(location.id,'');}}>הסרה</Button></li>;}
function Audit(){const q=useQuery({queryKey:['admin-audit'],queryFn:async()=>{const r=await supabase.from('admin_audit').select('*').order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;return r.data;}});const names=useQuery({queryKey:['users'],queryFn:useServerFn(listUsers)});return <section className="border-t pt-6"><h2 className="text-xl font-bold">יומן ניהול</h2><QueryState loading={q.isLoading} error={q.error} retry={()=>q.refetch()}/><ul className="divide-y text-sm">{q.data?.map(a=><li key={a.id} className="py-3">{new Date(a.created_at).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'})} · {names.data?.find(p=>p.id===a.actor_id)?.full_name??'מערכת'} · {({user_created:'נוצר משתמש',user_updated:'עודכן משתמש',location_insert:'נוסף מיקום',location_update:'עודכן מיקום',location_delete:'הוסר מיקום'} as Record<string,string>)[a.action]??'פעולת ניהול'} · {names.data?.find(p=>p.id===a.target_id)?.full_name??''}</li>)}</ul></section>;}