ALTER TABLE public.profiles ADD COLUMN email text;
ALTER TABLE public.tasks ADD COLUMN safety_check text, ADD COLUMN repair_notes text, ADD COLUMN safety_checked_at timestamptz, ADD COLUMN safety_checked_by uuid REFERENCES public.profiles(id), ADD COLUMN completed_by uuid REFERENCES public.profiles(id), ADD COLUMN request_key uuid, ADD COLUMN explicit_status boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX tasks_request_key ON public.tasks(created_by,request_key) WHERE request_key IS NOT NULL;
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT(id,full_name,phone,active,created_at,email) ON public.profiles TO authenticated;
CREATE TABLE public.admin_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, target_id uuid, action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.admin_audit TO authenticated; GRANT ALL ON public.admin_audit TO service_role;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.admin_audit FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'super_admin'));
CREATE TABLE public.task_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL REFERENCES public.tasks(id),user_id uuid NOT NULL DEFAULT auth.uid(),outcome text NOT NULL CHECK(outcome IN ('approved','rejected','instruction')),body text NOT NULL,approved_amount numeric CHECK(approved_amount>=0),next_status public.task_status NOT NULL,request_key uuid NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.task_decisions TO authenticated; GRANT ALL ON public.task_decisions TO service_role;
ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_read ON public.task_decisions FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE TABLE public.notification_preferences(user_id uuid PRIMARY KEY DEFAULT auth.uid(),assignment boolean NOT NULL DEFAULT true,approval boolean NOT NULL DEFAULT true,changes boolean NOT NULL DEFAULT true,due boolean NOT NULL DEFAULT true,safety boolean NOT NULL DEFAULT true);
GRANT SELECT,INSERT,UPDATE ON public.notification_preferences TO authenticated; GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_read ON public.notification_preferences FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY own_insert ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY own_update ON public.notification_preferences FOR UPDATE TO authenticated USING(user_id=auth.uid() AND public.is_staff(auth.uid())) WITH CHECK(user_id=auth.uid() AND public.is_staff(auth.uid()));
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,task_id uuid NOT NULL REFERENCES public.tasks(id),kind text NOT NULL,title text NOT NULL,read_at timestamptz, dedup_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,dedup_key));
GRANT SELECT ON public.notifications TO authenticated; GRANT UPDATE(read_at) ON public.notifications TO authenticated; GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_read ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY own_update ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid() AND public.is_staff(auth.uid())) WITH CHECK(user_id=auth.uid() AND public.is_staff(auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications,public.task_decisions,public.profiles,public.user_roles;
GRANT UPDATE,DELETE ON public.locations TO authenticated;
CREATE POLICY admin_update ON public.locations FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'super_admin')) WITH CHECK(public.has_role(auth.uid(),'super_admin'));
CREATE POLICY admin_delete ON public.locations FOR DELETE TO authenticated USING(public.has_role(auth.uid(),'super_admin'));
DROP POLICY "staff add locations" ON public.locations;
CREATE POLICY admin_insert ON public.locations FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'super_admin'));
CREATE OR REPLACE FUNCTION public.protect_last_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(812345);
 IF TG_TABLE_NAME='profiles' THEN
  IF OLD.active AND NOT NEW.active AND public.has_role(OLD.id,'super_admin') AND (SELECT count(*) FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.role='super_admin' AND p.active)<=1 THEN RAISE EXCEPTION 'LAST_ADMIN'; END IF; RETURN NEW;
 END IF;
 target:=OLD.user_id;
 IF OLD.role='super_admin' AND (TG_OP='DELETE' OR NEW.role<>'super_admin') AND EXISTS(SELECT 1 FROM public.profiles WHERE id=target AND active) AND (SELECT count(*) FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.role='super_admin' AND p.active)<=1 THEN RAISE EXCEPTION 'LAST_ADMIN'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER protect_profile BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin();
CREATE TRIGGER protect_role BEFORE UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin();
CREATE OR REPLACE FUNCTION public.admin_save_user(_actor uuid,_id uuid,_name text,_phone text,_email text,_role public.app_role,_active boolean,_hash text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oldp public.profiles; oldrole public.app_role;
BEGIN
 PERFORM pg_advisory_xact_lock(812345);
 IF NOT public.has_role(_actor,'super_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO oldp FROM public.profiles WHERE id=_id FOR UPDATE;
 SELECT role INTO oldrole FROM public.user_roles WHERE user_id=_id ORDER BY CASE role WHEN 'super_admin' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END LIMIT 1;
 IF oldp.id IS NULL THEN INSERT INTO public.profiles(id,full_name,phone,email,active,code_hash) VALUES(_id,_name,_phone,_email,_active,_hash); ELSE
 UPDATE public.profiles SET full_name=_name,phone=_phone,email=_email,active=_active,code_hash=coalesce(_hash,code_hash) WHERE id=_id; END IF;
 IF oldrole IS DISTINCT FROM _role THEN
  UPDATE public.user_roles SET role=_role WHERE user_id=_id AND role=oldrole;
  IF NOT FOUND THEN INSERT INTO public.user_roles(user_id,role) VALUES(_id,_role); END IF;
 END IF;
 INSERT INTO public.admin_audit(actor_id,target_id,action,details) VALUES(_actor,_id,CASE WHEN oldp.id IS NULL THEN 'user_created' ELSE 'user_updated' END,jsonb_build_object('name',_name,'phone',_phone,'email',_email,'role',_role,'active',_active,'code_replaced',_hash IS NOT NULL));
END $$;
REVOKE ALL ON FUNCTION public.admin_save_user(uuid,uuid,text,text,text,public.app_role,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_user(uuid,uuid,text,text,text,public.app_role,boolean,text) TO service_role;
CREATE OR REPLACE FUNCTION public.tasks_before_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 NEW.created_by:=coalesce(auth.uid(),NEW.created_by); NEW.updated_by:=NEW.created_by; NEW.created_at:=now(); NEW.updated_at:=now();
 IF NOT NEW.explicit_status AND NEW.status='new' THEN IF NEW.type='request' THEN NEW.status:='waiting_approval'; ELSIF NEW.type='decision' THEN NEW.status:='waiting_decision'; END IF; END IF;
 NEW.waiting_since:=CASE WHEN public.is_waiting(NEW.status) THEN now() ELSE NULL END;
 NEW.completed_at:=CASE WHEN NEW.status='closed' THEN now() ELSE NULL END;
 NEW.completed_by:=CASE WHEN NEW.status='closed' THEN NEW.created_by ELSE NULL END;
 NEW.safety_checked_at:=NULL; NEW.safety_checked_by:=NULL;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.tasks_before_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 NEW.id:=OLD.id; NEW.number:=OLD.number; NEW.created_by:=OLD.created_by; NEW.created_at:=OLD.created_at; NEW.request_key:=OLD.request_key;
 NEW.updated_at:=now(); NEW.updated_by:=coalesce(auth.uid(),NEW.updated_by);
 NEW.completed_at:=OLD.completed_at; NEW.completed_by:=OLD.completed_by; NEW.waiting_since:=OLD.waiting_since;
 NEW.safety_checked_at:=OLD.safety_checked_at; NEW.safety_checked_by:=OLD.safety_checked_by;
 IF OLD.equipment_disabled AND NOT NEW.equipment_disabled THEN
  IF nullif(trim(NEW.safety_check),'') IS NULL OR nullif(trim(NEW.repair_notes),'') IS NULL OR NEW.safety_check IS NOT DISTINCT FROM OLD.safety_check THEN RAISE EXCEPTION 'SAFETY_CHECK_REQUIRED'; END IF;
  NEW.safety_checked_at:=now(); NEW.safety_checked_by:=NEW.updated_by;
 END IF;
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  NEW.waiting_since:=CASE WHEN public.is_waiting(NEW.status) THEN now() ELSE NULL END;
  IF NEW.status='closed' THEN NEW.completed_at:=now(); NEW.completed_by:=NEW.updated_by; END IF;
 END IF;
 IF NEW.parent_id=NEW.id OR NEW.related_task_id=NEW.id THEN RAISE EXCEPTION 'SELF_LINK'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.tasks_after_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f text; o text; n text; oj jsonb:=to_jsonb(OLD); nj jsonb:=to_jsonb(NEW);
BEGIN
 FOREACH f IN ARRAY ARRAY['title','description','type','status','urgency','assignee_id','due_date','location','is_safety','equipment_disabled','next_step','external_party','delay_reason','delay_impact','requested_amount','parent_id','related_task_id','archived','repair_notes','safety_check','safety_checked_at','safety_checked_by','waiting_since','completed_at','completed_by'] LOOP
 o:=nullif(trim(oj->>f),''); n:=nullif(trim(nj->>f),'');
 IF o IS DISTINCT FROM n THEN INSERT INTO public.task_history(task_id,user_id,action,field,old_value,new_value) VALUES(NEW.id,NEW.updated_by,CASE WHEN f='status' THEN 'status_change' WHEN f='archived' THEN CASE WHEN NEW.archived THEN 'archived' ELSE 'restored' END ELSE 'updated' END,f,o,n); END IF;
 END LOOP; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.record_decision(_task uuid,_outcome text,_body text,_amount numeric,_next public.task_status,_expected timestamptz,_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tasks; result uuid;
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT id INTO result FROM public.task_decisions WHERE request_key=_key AND user_id=auth.uid(); IF FOUND THEN RETURN result; END IF;
 SELECT * INTO t FROM public.tasks WHERE id=_task FOR UPDATE;
 IF t.id IS NULL OR t.archived OR t.updated_at<>_expected OR t.status NOT IN ('waiting_approval','waiting_decision') THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 IF length(trim(_body))=0 OR length(_body)>5000 THEN RAISE EXCEPTION 'BODY_REQUIRED'; END IF;
 INSERT INTO public.task_decisions(task_id,outcome,body,approved_amount,next_status,request_key) VALUES(_task,_outcome,trim(_body),_amount,_next,_key) RETURNING id INTO result;
 UPDATE public.tasks SET status=_next WHERE id=_task;
 INSERT INTO public.task_history(task_id,user_id,action,new_value) VALUES(_task,auth.uid(),'decision',_outcome||': '||trim(_body)||CASE WHEN _amount IS NULL THEN '' ELSE ' | ₪'||_amount END);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.record_decision(uuid,text,text,numeric,public.task_status,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_decision(uuid,text,text,numeric,public.task_status,timestamptz,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.task_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; k text; prefs public.notification_preferences;
BEGIN
 IF NEW.archived THEN RETURN NEW; END IF;
 FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id WHERE ur.role IN ('super_admin','staff') AND p.active LOOP
 SELECT * INTO prefs FROM public.notification_preferences WHERE user_id=r.user_id;
 k:=NULL;
 IF NEW.is_safety AND NEW.urgency='critical' AND coalesce(prefs.safety,true) THEN k:='safety';
 ELSIF NEW.status IN ('waiting_approval','waiting_decision') AND coalesce(prefs.approval,true) AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN k:='approval';
 ELSIF NEW.assignee_id=r.user_id AND coalesce(prefs.assignment,true) AND (TG_OP='INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN k:='assignment';
 ELSIF TG_OP='UPDATE' AND r.user_id IS DISTINCT FROM NEW.updated_by AND coalesce(prefs.changes,true) AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.urgency IS DISTINCT FROM OLD.urgency OR NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.next_step IS DISTINCT FROM OLD.next_step) THEN k:='changes'; END IF;
 IF k IS NOT NULL THEN INSERT INTO public.notifications(user_id,task_id,kind,title,dedup_key) VALUES(r.user_id,NEW.id,k,NEW.title,NEW.id||':'||NEW.updated_at||':'||k) ON CONFLICT DO NOTHING; END IF;
 END LOOP; RETURN NEW;
END $$;
CREATE TRIGGER task_notify AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.task_notify();
CREATE OR REPLACE FUNCTION public.refresh_due_notifications() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM public.notification_preferences WHERE user_id=auth.uid() AND NOT due) THEN RETURN; END IF;
 INSERT INTO public.notifications(user_id,task_id,kind,title,dedup_key)
 SELECT auth.uid(),t.id,CASE WHEN t.due_date<(now() AT TIME ZONE 'Asia/Jerusalem')::date THEN 'overdue' ELSE 'due' END,t.title,t.id||':due:'||t.due_date||':'||CASE WHEN t.due_date<(now() AT TIME ZONE 'Asia/Jerusalem')::date THEN 'overdue' ELSE 'due' END FROM public.tasks t WHERE NOT t.archived AND t.status NOT IN ('closed','cancelled') AND t.due_date<=(now() AT TIME ZONE 'Asia/Jerusalem')::date+2 ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.refresh_due_notifications() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.refresh_due_notifications() TO authenticated;
CREATE OR REPLACE FUNCTION public.location_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN INSERT INTO public.admin_audit(actor_id,action,details) VALUES(auth.uid(),'location_'||lower(TG_OP),jsonb_build_object('old',CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.name END,'new',CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.name END)); IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER location_audit AFTER INSERT OR UPDATE OR DELETE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.location_audit();
CREATE OR REPLACE FUNCTION public.submit_report_once(_title text,_description text,_key uuid) RETURNS TABLE(id uuid,number bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE profiles.id=auth.uid() AND active) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF length(trim(coalesce(_title,'')))=0 OR length(_title)>200 OR length(_description)>5000 THEN RAISE EXCEPTION 'INVALID'; END IF;
 RETURN QUERY INSERT INTO public.tasks(title,description,type,request_key) VALUES(trim(_title),nullif(trim(_description),''),'fault',_key) ON CONFLICT(created_by,request_key) WHERE request_key IS NOT NULL DO UPDATE SET request_key=excluded.request_key RETURNING tasks.id,tasks.number;
END $$;
REVOKE ALL ON FUNCTION public.submit_report_once(text,text,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.submit_report_once(text,text,uuid) TO authenticated;