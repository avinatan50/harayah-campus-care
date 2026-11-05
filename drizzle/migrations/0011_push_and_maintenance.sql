-- Push subscriptions
CREATE TABLE public.push_subscriptions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_read ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.register_push(_endpoint text, _p256dh text, _auth text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF length(_endpoint) > 1000 OR _endpoint NOT LIKE 'https://%' THEN RAISE EXCEPTION 'INVALID'; END IF;
  INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth) VALUES(auth.uid(),_endpoint,_p256dh,_auth)
  ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth;
END $$;
CREATE OR REPLACE FUNCTION public.unregister_push(_endpoint text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  DELETE FROM public.push_subscriptions WHERE endpoint=_endpoint AND user_id=auth.uid();
$$;
REVOKE ALL ON FUNCTION public.register_push(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unregister_push(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push(text) TO authenticated;

-- Super admin push settings
ALTER TABLE public.notification_preferences ADD COLUMN push_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.notification_preferences ADD COLUMN push_muted_until timestamptz;

-- Outbox (server only)
CREATE TABLE public.push_outbox(
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '/',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT ALL ON public.push_outbox TO service_role;
GRANT USAGE ON SEQUENCE public.push_outbox_id_seq TO service_role;
ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX push_outbox_pending ON public.push_outbox(id) WHERE sent_at IS NULL;

CREATE OR REPLACE FUNCTION public.claim_push_outbox(_limit int) RETURNS SETOF public.push_outbox
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  DELETE FROM public.push_outbox WHERE sent_at < now() - interval '7 days';
  UPDATE public.push_outbox SET sent_at=now() WHERE id IN (
    SELECT id FROM public.push_outbox WHERE sent_at IS NULL AND created_at > now() - interval '1 day'
    ORDER BY id LIMIT _limit FOR UPDATE SKIP LOCKED) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_push_outbox(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_outbox(int) TO service_role;

CREATE OR REPLACE FUNCTION public.status_label(s public.task_status) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s WHEN 'new' THEN 'חדש' WHEN 'in_progress' THEN 'בטיפול' WHEN 'waiting_approval' THEN 'ממתין לאישור'
   WHEN 'waiting_decision' THEN 'ממתין להחלטה' WHEN 'waiting_external' THEN 'ממתין לגורם חיצוני' WHEN 'approved' THEN 'מאושר'
   WHEN 'closed' THEN 'טופל' WHEN 'paused' THEN 'מושהה' WHEN 'cancelled' THEN 'בוטל' ELSE s::text END $$;

-- Enqueue for every super admin who has push on and is not muted, except the actor
CREATE OR REPLACE FUNCTION public.enqueue_admin_push(_title text, _body text, _url text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.push_outbox(user_id,title,body,url)
  SELECT ur.user_id, left(_title,120), left(coalesce(_body,''),300), _url
  FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id
  LEFT JOIN public.notification_preferences np ON np.user_id=ur.user_id
  WHERE ur.role='super_admin' AND p.active AND p.deleted_at IS NULL
    AND coalesce(np.push_enabled,true) AND (np.push_muted_until IS NULL OR np.push_muted_until < now())
    AND ur.user_id IS DISTINCT FROM auth.uid()
    AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id=ur.user_id);
END $$;
REVOKE ALL ON FUNCTION public.enqueue_admin_push(text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_on_task() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pre text := CASE WHEN NEW.is_safety THEN '⚠️ ' ELSE '' END;
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.enqueue_admin_push(pre||'קריאה חדשה #'||NEW.number, NEW.title, '/tasks/'||NEW.id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.enqueue_admin_push(pre||'שינוי סטטוס #'||NEW.number, NEW.title||': '||public.status_label(OLD.status)||' ← '||public.status_label(NEW.status), '/tasks/'||NEW.id);
  ELSIF NEW.archived IS DISTINCT FROM OLD.archived THEN
    PERFORM public.enqueue_admin_push(CASE WHEN NEW.archived THEN 'הועבר לארכיון #' ELSE 'שוחזר מארכיון #' END||NEW.number, NEW.title, '/tasks/'||NEW.id);
  ELSIF (NEW.title, NEW.description, NEW.urgency, NEW.assignee_id, NEW.location, NEW.is_safety, NEW.type)
     IS DISTINCT FROM (OLD.title, OLD.description, OLD.urgency, OLD.assignee_id, OLD.location, OLD.is_safety, OLD.type) THEN
    PERFORM public.enqueue_admin_push(pre||'עדכון במשימה #'||NEW.number, NEW.title, '/tasks/'||NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER push_on_task AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.push_on_task();

CREATE OR REPLACE FUNCTION public.push_on_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record;
BEGIN
  SELECT number,title INTO t FROM public.tasks WHERE id=NEW.task_id;
  PERFORM public.enqueue_admin_push('הערה חדשה #'||t.number, t.title||': '||NEW.body, '/tasks/'||NEW.task_id);
  RETURN NEW;
END $$;
CREATE TRIGGER push_on_comment AFTER INSERT ON public.task_comments FOR EACH ROW EXECUTE FUNCTION public.push_on_comment();

CREATE OR REPLACE FUNCTION public.push_on_decision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record;
BEGIN
  SELECT number,title INTO t FROM public.tasks WHERE id=NEW.task_id;
  PERFORM public.enqueue_admin_push('נרשם אישור/החלטה #'||t.number, t.title||': '||NEW.body, '/tasks/'||NEW.task_id);
  RETURN NEW;
END $$;
CREATE TRIGGER push_on_decision AFTER INSERT ON public.task_decisions FOR EACH ROW EXECUTE FUNCTION public.push_on_decision();

CREATE OR REPLACE FUNCTION public.push_on_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.enqueue_admin_push('משתמש חדש נרשם', NEW.full_name, '/users');
  RETURN NEW;
END $$;
CREATE TRIGGER push_on_profile AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.push_on_profile();

-- Hidden periodic maintenance (super admin only)
CREATE TABLE public.maintenance_routines(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  interval_months int NOT NULL DEFAULT 1 CHECK (interval_months BETWEEN 1 AND 24),
  anchor_date date NOT NULL DEFAULT current_date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.maintenance_routine_locations(
  routine_id uuid NOT NULL REFERENCES public.maintenance_routines(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  PRIMARY KEY(routine_id, location_id)
);
CREATE TABLE public.maintenance_checks(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid NOT NULL REFERENCES public.maintenance_routines(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  cycle_start date NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid DEFAULT auth.uid(),
  note text,
  UNIQUE(routine_id, location_id, cycle_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_routines, public.maintenance_routine_locations, public.maintenance_checks TO authenticated;
GRANT ALL ON public.maintenance_routines, public.maintenance_routine_locations, public.maintenance_checks TO service_role;
ALTER TABLE public.maintenance_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_routine_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY super_admin_all ON public.maintenance_routines FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY super_admin_all ON public.maintenance_routine_locations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY super_admin_all ON public.maintenance_checks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- Seed common safety routines, attached to every leaf location
WITH r AS (
  INSERT INTO public.maintenance_routines(title, description, interval_months) VALUES
   ('בדיקת מטפים וגלגלוני כיבוי', 'בדיקת לחץ, תוקף ופלומבה בכל מטף וגלגלון', 6),
   ('בדיקת תאורת חירום ושילוט יציאה', 'לחיצה על כפתור הבדיקה ווידוא דליקה', 1),
   ('ניקוי פילטרים ובדיקת מזגנים', 'ניקוי פילטרים, בדיקת ניקוז ופעולה תקינה', 6),
   ('בדיקת גלאי עשן', 'בדיקת פעולה והחלפת סוללה לפי צורך', 12),
   ('ביקורת בטיחות כללית', 'מעקות, שקעים, ריהוט רופף, דלתות ומפגעים', 12)
  RETURNING id)
INSERT INTO public.maintenance_routine_locations(routine_id, location_id)
SELECT r.id, l.id FROM r CROSS JOIN public.locations l
WHERE NOT EXISTS (SELECT 1 FROM public.locations c WHERE c.parent_id = l.id);