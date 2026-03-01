ALTER TABLE text_detections
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS semantic_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS canonical_text TEXT,
  ADD COLUMN IF NOT EXISTS variation_group_id UUID,
  ADD COLUMN IF NOT EXISTS variation_similarity NUMERIC,
  ADD COLUMN IF NOT EXISTS is_name_or_brand BOOLEAN NOT NULL DEFAULT false;

UPDATE text_detections
SET category = CASE
  WHEN is_partial_sequence THEN 'partial_sequence'
  WHEN is_fixed_text THEN 'fixed_text'
  ELSE 'subtitle_text'
END
WHERE category IS NULL;

ALTER TABLE text_detections
  ALTER COLUMN category SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'text_detections_category_check'
  ) THEN
    ALTER TABLE text_detections
      ADD CONSTRAINT text_detections_category_check
      CHECK (category IN ('partial_sequence', 'fixed_text', 'subtitle_text'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_text_detections_project_category
  ON text_detections(project_id, category);

CREATE INDEX IF NOT EXISTS idx_text_detections_project_variation_group
  ON text_detections(project_id, variation_group_id);

