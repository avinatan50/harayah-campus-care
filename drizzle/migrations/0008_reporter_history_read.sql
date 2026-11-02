-- A reporter can now read their own calls: needed for the "my previous calls" view under the quick-call form.
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.active)
$$;
REVOKE ALL ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated;

GRANT SELECT ON public.tasks TO authenticated;
GRANT SELECT ON public.task_decisions TO authenticated;
GRANT SELECT ON public.task_files TO authenticated;

CREATE POLICY "reporter read own tasks" ON public.tasks FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND public.is_active_user(auth.uid()));

CREATE POLICY "reporter read own decisions" ON public.task_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_decisions.task_id AND t.created_by = auth.uid()));

CREATE POLICY "reporter read own files" ON public.task_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_files.task_id AND t.created_by = auth.uid()));

CREATE POLICY "reporter read own storage objects" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-files' AND EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id::text = (storage.foldername(name))[1] AND t.created_by = auth.uid()));