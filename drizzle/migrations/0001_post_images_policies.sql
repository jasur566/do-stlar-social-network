
CREATE POLICY "post images read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'post-images');
CREATE POLICY "post images upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "post images delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
