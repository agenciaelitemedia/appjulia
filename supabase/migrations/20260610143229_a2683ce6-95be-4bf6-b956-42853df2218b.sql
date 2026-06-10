CREATE POLICY "App can upload help media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-media' AND name LIKE 'help/%');
CREATE POLICY "App can update help media" ON storage.objects FOR UPDATE USING (bucket_id = 'chat-media' AND name LIKE 'help/%');
CREATE POLICY "App can delete help media" ON storage.objects FOR DELETE USING (bucket_id = 'chat-media' AND name LIKE 'help/%');