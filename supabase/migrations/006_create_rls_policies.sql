-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spelling_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mismatches ENABLE ROW LEVEL SECURITY;

-- Projects: users can only access their own
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE USING (auth.uid() = user_id);

-- Text detections: read via project ownership
CREATE POLICY "Users can view own text_detections"
  ON text_detections FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Transcriptions: read via project ownership
CREATE POLICY "Users can view own transcriptions"
  ON transcriptions FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Spelling errors: read via project ownership
CREATE POLICY "Users can view own spelling_errors"
  ON spelling_errors FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Mismatches: read via project ownership
CREATE POLICY "Users can view own mismatches"
  ON mismatches FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Enable Realtime on projects table
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
