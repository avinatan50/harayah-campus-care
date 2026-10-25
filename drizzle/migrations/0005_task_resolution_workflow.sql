ALTER TABLE public.task_decisions ADD COLUMN destination_type public.task_type;
COMMENT ON COLUMN public.task_decisions.destination_type IS 'Task or fault destination chosen when resolving a decision';
CREATE OR REPLACE FUNCTION public.record_task_resolution(_task uuid,_outcome text,_body text,_next public.task_status,_expected timestamptz,_key uuid,_amount numeric DEFAULT NULL,_destination public.task_type DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tasks; result uuid; next_status public.task_status;
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT id INTO result FROM public.task_decisions WHERE request_key=_key AND user_id=auth.uid(); IF FOUND THEN RETURN result; END IF;
 SELECT * INTO t FROM public.tasks WHERE id=_task FOR UPDATE;
 IF t.id IS NULL OR t.archived OR t.updated_at IS DISTINCT FROM _expected OR t.status NOT IN ('waiting_approval','waiting_decision') THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 IF _outcome IS NULL OR _outcome NOT IN ('approved','rejected','instruction') THEN RAISE EXCEPTION 'INVALID_OUTCOME'; END IF;
 IF nullif(trim(_body),'') IS NULL OR length(_body)>5000 THEN RAISE EXCEPTION 'BODY_REQUIRED'; END IF;
 IF _amount<0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
 IF t.status='waiting_decision' AND (_destination IS NULL OR _destination NOT IN ('task','fault')) THEN RAISE EXCEPTION 'DESTINATION_REQUIRED'; END IF;
 IF _destination IS NOT NULL AND _destination NOT IN ('task','fault') THEN RAISE EXCEPTION 'INVALID_DESTINATION'; END IF;
 next_status:=CASE WHEN _outcome='approved' THEN 'approved'::public.task_status ELSE _next END;
 IF next_status IS NULL OR next_status IN ('done_pending_close','recurring_fault') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
 INSERT INTO public.task_decisions(task_id,outcome,body,approved_amount,next_status,request_key,destination_type) VALUES(_task,_outcome,trim(_body),_amount,next_status,_key,CASE WHEN t.status='waiting_decision' THEN _destination ELSE NULL END) RETURNING id INTO result;
 UPDATE public.tasks SET status=next_status,type=CASE WHEN t.status='waiting_decision' THEN _destination ELSE type END WHERE id=_task;
 INSERT INTO public.task_history(task_id,user_id,action,new_value) VALUES(_task,auth.uid(),'decision',_outcome||': '||trim(_body)||CASE WHEN _amount IS NULL THEN '' ELSE ' | ₪'||_amount END);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.record_task_resolution(uuid,text,text,public.task_status,timestamptz,uuid,numeric,public.task_type) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_task_resolution(uuid,text,text,public.task_status,timestamptz,uuid,numeric,public.task_type) TO authenticated;
CREATE OR REPLACE FUNCTION public.record_decision(_task uuid,_outcome text,_body text,_amount numeric,_next public.task_status,_expected timestamptz,_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN public.record_task_resolution(_task,_outcome,_body,_next,_expected,_key,_amount,'task'); END $$;
CREATE OR REPLACE FUNCTION public.normalize_task_status() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.status='done_pending_close' THEN NEW.status:='closed'; ELSIF NEW.status='recurring_fault' THEN NEW.status:='new'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_normalize_task_status BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.normalize_task_status();
COMMENT ON TYPE public.task_status IS 'closed means handled (טופל); done_pending_close and recurring_fault are deprecated and normalized to closed and new on write';