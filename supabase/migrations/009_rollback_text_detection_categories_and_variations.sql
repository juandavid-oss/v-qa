-- Rollback for experimental text categorization columns.
-- Safe to run multiple times.

DROP INDEX IF EXISTS idx_text_detections_project_category;
DROP INDEX IF EXISTS idx_text_detections_project_variation_group;

ALTER TABLE text_detections
  DROP CONSTRAINT IF EXISTS text_detections_category_check;

ALTER TABLE text_detections
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS semantic_tags,
  DROP COLUMN IF EXISTS canonical_text,
  DROP COLUMN IF EXISTS variation_group_id,
  DROP COLUMN IF EXISTS variation_similarity,
  DROP COLUMN IF EXISTS is_name_or_brand;

