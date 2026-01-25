-- Create storage bucket for creative files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creatives', 
  'creatives', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
);

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload creative files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'creatives');

-- Allow public read access
CREATE POLICY "Public read access for creatives"
ON storage.objects FOR SELECT
USING (bucket_id = 'creatives');

-- Allow users to delete their own files (based on folder structure user_id/filename)
CREATE POLICY "Users can delete own creative files"
ON storage.objects FOR DELETE
USING (bucket_id = 'creatives');