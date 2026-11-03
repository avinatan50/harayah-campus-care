ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.task_comments.is_public IS 'true = visible to the call reporter; false = internal staff note';
CREATE POLICY "reporter read public comments" ON public.task_comments FOR SELECT TO authenticated
USING (is_public AND public.is_active_user(auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id AND t.created_by = auth.uid()));