CREATE TABLE text_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  start_time NUMERIC NOT NULL,
  end_time NUMERIC NOT NULL,
  bbox_top NUMERIC,
  bbox_left NUMERIC,
  bbox_bottom NUMERIC,
  bbox_right NUMERIC,
  confidence NUMERIC,
  is_subtitle BOOLEAN DEFAULT false,
  is_fixed_text BOOLEAN DEFAULT false,
  is_partial_sequence BOOLEAN DEFAULT false,
  merged_text_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_text_detections_project ON text_detections(project_id);
CREATE INDEX idx_text_detections_time ON text_detections(project_id, start_time);
