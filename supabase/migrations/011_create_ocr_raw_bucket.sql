INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ocr-raw', 'ocr-raw', false, 52428800, ARRAY['application/json'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

