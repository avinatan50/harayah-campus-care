import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const listUsers = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: allowed } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' });
  if (!allowed) throw new Error('אין הרשאה לניהול משתמשים');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { data: profiles, error } = await db.from('profiles').select('id,full_name,phone,email,active,created_at').order('full_name');
  if (error) throw new Error('טעינת המשתמשים נכשלה');
  const { data: roles, error: roleError } = await db.from('user_roles').select('user_id,role');
  if (roleError) throw new Error('טעינת התפקידים נכשלה');
  return (profiles ?? []).map(p => ({ ...p, role: roles?.find(r => r.user_id === p.id)?.role ?? 'user' as const }));
});

const schema = z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(100), phone: z.string().trim().max(15).refine(v => !v || /^[0-9+\-\s]{9,15}$/.test(v)), email: z.union([z.literal(''),z.string().email()]), role: z.enum(['super_admin','staff','user']), active: z.boolean(), code: z.union([z.literal(''),z.string().regex(/^\d{4}$/)]), create: z.boolean() });
export const saveUser = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: z.infer<typeof schema>) => schema.parse(input)).handler(async ({ data, context }) => {
  const { data: allowed } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' });
  if (!allowed) throw new Error('אין הרשאה לניהול משתמשים');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  let hash: string | undefined;
  if (data.code) {
    const pepper = process.env['CODE_PEPPER'];
    if (!pepper) throw new Error('שירות הקודים אינו זמין');
    const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    hash = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data.code)))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const taken = await db.from('profiles').select('id').eq('code_hash',hash).neq('id',data.id).maybeSingle();
    if (taken.error || taken.data) return { ok: false, error: 'קוד זה אינו זמין. בחרו קוד אחר.' };
  }
  if (data.create && !hash) return { ok: false, error: 'נדרש קוד בן 4 ספרות למשתמש חדש' };
  let created = false;
  let id = data.id;
  if (data.create) {
    const existing = await db.from('profiles').select('id').eq('id',data.id).maybeSingle();
    if (existing.data) return { ok: true };
    // Caller-supplied UUID is an idempotency key for concurrent creation attempts.
    const email = `u-${data.id}@users.haraaya.local`;
    const password = crypto.randomUUID()+crypto.randomUUID();
    const result = await db.auth.admin.createUser({ id:data.id, email, password, email_confirm: true });
    if (result.error || !result.data.user) {
      const retry = await db.from('profiles').select('id').eq('id',data.id).maybeSingle();
      if(retry.data) return {ok:true};
      return { ok: false, error: 'יצירת המשתמש נכשלה; רעננו את הרשימה לפני ניסיון נוסף' };
    }
    id = result.data.user.id; created = true;
  }
  const result = await db.rpc('admin_save_user',{ _actor:context.userId,_id:id,_name:data.name,_phone:data.phone,_email:data.email,_role:data.role,_active:data.active,_hash:hash });
  if (result.error) {
    if (created) await db.auth.admin.deleteUser(id);
    return { ok: false, error: result.error.message.includes('LAST_ADMIN') ? 'לא ניתן לחסום או לשנות את תפקיד המנהל הראשי האחרון' : result.error.code === '23505' ? 'קוד זה אינו זמין' : 'השמירה נכשלה' };
  }
  if (hash && !created) {
    const reset = await db.auth.admin.updateUserById(id,{ password: crypto.randomUUID()+crypto.randomUUID() });
    if (reset.error) return { ok:false,error:'הקוד הוחלף, אך ביטול החיבורים הישנים נכשל; נסו שוב' };
  }
  return { ok: true };
});