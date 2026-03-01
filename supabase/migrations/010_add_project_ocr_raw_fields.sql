ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS ocr_raw_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS ocr_raw_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ocr_raw_size_bytes BIGINT;

