
CREATE POLICY "letterheads own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'letterheads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "letterheads own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'letterheads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "letterheads own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'letterheads' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'letterheads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "letterheads own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'letterheads' AND auth.uid()::text = (storage.foldername(name))[1]);
