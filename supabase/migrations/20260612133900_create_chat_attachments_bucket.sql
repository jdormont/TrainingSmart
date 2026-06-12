-- Create chat-attachments storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public read access to chat-attachments bucket
CREATE POLICY "Public read access to chat-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

-- Policy: Allow authenticated users to upload to chat-attachments bucket
CREATE POLICY "Authenticated users can upload to chat-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
);

-- Policy: Allow authenticated users to delete their own files in chat-attachments bucket
CREATE POLICY "Authenticated users can delete from chat-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
);
