CREATE TYPE public.app_role AS ENUM ('super_admin','staff','user');
CREATE TYPE public.task_type AS ENUM ('task','fault','request','decision');
CREATE TYPE public.task_status AS ENUM ('new','in_progress','waiting_decision','waiting_approval','waiting_external','paused','done_pending_close','closed','recurring_fault','cancelled');
CREATE TYPE public.task_urgency AS ENUM ('normal','high','critical');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  code_hash text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = _user_id AND r.role = _role AND p.active)
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = _user_id AND r.role IN ('super_admin','staff') AND p.active)
$$;

-- code_hash is never readable: column-level revoke
REVOKE SELECT (code_hash) ON public.profiles FROM authenticated;

CREATE POLICY "own or staff read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own or staff read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- Admin seeds (bootstrap of the 3 management accounts)
CREATE TABLE public.admin_seeds (
  email text PRIMARY KEY,
  full_name text NOT NULL,
  role public.app_role NOT NULL,
  claimed_at timestamptz
);
GRANT ALL ON public.admin_seeds TO service_role;
ALTER TABLE public.admin_seeds ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_seeds (email, full_name, role) VALUES
  ('avinatan50@gmail.com','אבי נתן','super_admin'),
  ('eliyahuper@gmail.com','מנהל','staff'),
  ('tthareaya@gmail.com','מיכל','staff');

-- Login attempts (rate limiting)
CREATE TABLE public.login_attempts (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  kind text NOT NULL,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.login_attempts (ip, created_at);
GRANT ALL ON public.login_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.login_attempts_id_seq TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Locations
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read locations" ON public.locations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff add locations" ON public.locations FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
INSERT INTO public.locations (name) VALUES ('בניין ראשי'),('חצר'),('כיתות'),('משרד'),('אולם'),('מטבח'),('שירותים');

-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  type public.task_type NOT NULL DEFAULT 'task',
  status public.task_status NOT NULL DEFAULT 'new',
  urgency public.task_urgency NOT NULL DEFAULT 'normal',
  assignee_id uuid REFERENCES public.profiles(id),
  due_date date,
  location text,
  is_safety boolean NOT NULL DEFAULT false,
  equipment_disabled boolean NOT NULL DEFAULT false,
  next_step text,
  external_party text,
  delay_reason text,
  delay_impact text,
  requested_amount numeric,
  parent_id uuid REFERENCES public.tasks(id),
  related_task_id uuid REFERENCES public.tasks(id),
  waiting_since timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  archived boolean NOT NULL DEFAULT false
);
CREATE INDEX ON public.tasks (updated_at DESC);
CREATE INDEX ON public.tasks (status);
GRANT SELECT, INSERT, UPDATE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tasks" ON public.tasks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- History (read-only in UI)
CREATE TABLE public.task_history (
  id bigserial PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.task_history (task_id, created_at);
GRANT SELECT ON public.task_history TO authenticated;
GRANT ALL ON public.task_history TO service_role;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read history" ON public.task_history FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Comments
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) DEFAULT auth.uid(),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read comments" ON public.task_comments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff add comments" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND user_id = auth.uid());

-- Files
CREATE TABLE public.task_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size bigint,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.task_files TO authenticated;
GRANT ALL ON public.task_files TO service_role;
ALTER TABLE public.task_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read files" ON public.task_files FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff or reporter add files" ON public.task_files FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid() AND (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.created_by = auth.uid() AND t.created_at > now() - interval '1 hour')));

-- Helper: is a status a waiting status
CREATE OR REPLACE FUNCTION public.is_waiting(s public.task_status) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT s IN ('waiting_decision','waiting_approval','waiting_external','paused') $$;

-- BEFORE INSERT: defaults
CREATE OR REPLACE FUNCTION public.tasks_before_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  NEW.updated_by := NEW.created_by;
  NEW.created_at := now(); NEW.updated_at := now();
  IF NEW.status IS NULL OR NEW.status = 'new' THEN
    -- 'new' is the column default: apply type defaults unless caller explicitly chose otherwise
    IF NEW.type = 'request' THEN NEW.status := 'waiting_approval';
    ELSIF NEW.type = 'decision' THEN NEW.status := 'waiting_decision';
    ELSE NEW.status := 'new'; END IF;
  END IF;
  IF public.is_waiting(NEW.status) THEN NEW.waiting_since := now(); END IF;
  IF NEW.status = 'closed' THEN NEW.completed_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_before_insert BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_before_insert();

CREATE OR REPLACE FUNCTION public.tasks_after_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.task_history (task_id, user_id, action, new_value) VALUES (NEW.id, NEW.created_by, 'created', NEW.status::text);
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_after_insert AFTER INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_after_insert();

CREATE OR REPLACE FUNCTION public.tasks_before_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.id := OLD.id; NEW.number := OLD.number; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  NEW.updated_at := now(); NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF public.is_waiting(NEW.status) THEN NEW.waiting_since := now();
    ELSE NEW.waiting_since := NULL; END IF;
    IF NEW.status = 'closed' THEN NEW.completed_at := now();
    ELSIF OLD.status = 'closed' THEN NEW.completed_at := NULL; END IF;
  ELSE
    NEW.waiting_since := OLD.waiting_since; NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_before_update BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_before_update();

CREATE OR REPLACE FUNCTION public.tasks_after_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f text; o text; n text;
  fields text[] := ARRAY['title','description','type','status','urgency','assignee_id','due_date','location','is_safety','equipment_disabled','next_step','external_party','delay_reason','delay_impact','requested_amount','parent_id','related_task_id','archived'];
  oj jsonb := to_jsonb(OLD); nj jsonb := to_jsonb(NEW);
BEGIN
  FOREACH f IN ARRAY fields LOOP
    o := NULLIF(trim(oj->>f), ''); n := NULLIF(trim(nj->>f), '');
    IF o IS DISTINCT FROM n THEN
      INSERT INTO public.task_history (task_id, user_id, action, field, old_value, new_value)
      VALUES (NEW.id, NEW.updated_by,
        CASE WHEN f='status' THEN 'status_change' WHEN f='archived' THEN (CASE WHEN n='true' THEN 'archived' ELSE 'restored' END) ELSE 'updated' END,
        f, o, n);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_after_update AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_after_update();

-- Quick report for regular users
CREATE OR REPLACE FUNCTION public.submit_report(_title text, _description text)
RETURNS TABLE (id uuid, number bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND active) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF length(trim(coalesce(_title,''))) = 0 THEN RAISE EXCEPTION 'title required'; END IF;
  INSERT INTO public.tasks (title, description, type, status, urgency)
  VALUES (left(trim(_title), 200), left(_description, 5000), 'fault', 'new', 'normal')
  RETURNING tasks.id, tasks.number INTO r;
  RETURN QUERY SELECT r.id, r.number;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_report(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_report(text, text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
