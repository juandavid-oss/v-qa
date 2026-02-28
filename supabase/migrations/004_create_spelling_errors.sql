CREATE TABLE spelling_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('subtitle', 'transcription')),
  original_text TEXT NOT NULL,
  suggested_text TEXT NOT NULL,
  context TEXT,
  timestamp NUMERIC NOT NULL,
  rule_id TEXT,
  is_false_positive BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_spelling_errors_project ON spelling_errors(project_id);
