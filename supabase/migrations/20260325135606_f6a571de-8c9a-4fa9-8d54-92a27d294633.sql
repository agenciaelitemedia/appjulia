
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-media', 'chat-media', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','audio/ogg','audio/mpeg','audio/mp4','video/mp4','application/pdf','application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read chat-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-media');

CREATE POLICY "Service write chat-media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-media');
