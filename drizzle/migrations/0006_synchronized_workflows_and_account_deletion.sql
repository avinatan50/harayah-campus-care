ALTER TABLE public.profiles ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
COMMENT ON COLUMN public.profiles.deleted_at IS 'Deleted login account; retained profile is a historical attribution record only';
CREATE OR REPLACE FUNCTION public.admin_prepare_user_deletion(_actor uuid,_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(812345);
 IF NOT public.has_role(_actor,'super_admin') OR _actor=_target THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF public.has_role(_target,'super_admin') AND (SELECT count(*) FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.role='super_admin' AND p.active)<=1 THEN RAISE EXCEPTION 'LAST_ADMIN'; END IF;
 UPDATE public.profiles SET active=false,code_hash=NULL WHERE id=_target;
END $$;
REVOKE ALL ON FUNCTION public.admin_prepare_user_deletion(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_prepare_user_deletion(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.admin_finish_user_deletion(_actor uuid,_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(_actor,'super_admin') OR _actor=_target THEN RAISE EXCEPTION 'Forbidden'; END IF;
 UPDATE public.profiles SET active=false,code_hash=NULL,deleted_at=now(),phone=NULL,email=NULL WHERE id=_target;
 INSERT INTO public.admin_audit(actor_id,target_id,action) VALUES(_actor,_target,'user_deleted');
END $$;
REVOKE ALL ON FUNCTION public.admin_finish_user_deletion(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finish_user_deletion(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.tasks_before_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 NEW.created_by:=coalesce(auth.uid(),NEW.created_by); NEW.updated_by:=NEW.created_by; NEW.created_at:=now(); NEW.updated_at:=now();
 IF NEW.type='request' THEN NEW.status:='waiting_approval'; ELSIF NEW.type='decision' THEN NEW.status:='waiting_decision'; END IF;
 NEW.waiting_since:=CASE WHEN public.is_waiting(NEW.status) THEN now() ELSE NULL END;
 NEW.completed_at:=CASE WHEN NEW.status='closed' THEN now() ELSE NULL END;
 NEW.completed_by:=CASE WHEN NEW.status='closed' THEN NEW.created_by ELSE NULL END;
 NEW.safety_checked_at:=NULL; NEW.safety_checked_by:=NULL;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['tasks','task_history','task_comments','task_decisions','notifications'] LOOP IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF; END LOOP; END $$;