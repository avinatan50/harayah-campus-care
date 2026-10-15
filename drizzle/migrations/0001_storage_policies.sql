CREATE POLICY "task files staff read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-files' AND public.is_staff(auth.uid()));
CREATE POLICY "task files upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files' AND (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id::text = (storage.foldername(name))[1]
      AND t.created_by = auth.uid() AND t.created_at > now() - interval '1 hour')));