export type ProjectStatus =
  | "pending"
  | "fetching_video"
  | "detecting_text"
  | "transcribing_audio"
  | "checking_spelling"
  | "detecting_mismatches"
  | "completed"
  | "error";

export type MismatchSeverity = "low" | "medium" | "high";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  frame_io_url: string;
  frame_io_asset_id: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  status: ProjectStatus;
  progress: number;
  error_message: string | null;
  ocr_raw_storage_path?: string | null;
  ocr_raw_generated_at?: string | null;
  ocr_raw_size_bytes?: number | null;
  created_at: string;
  updated_at: string;
}

export interface TextDetection {
  id: string;
  project_id: string;
  text: string;
  start_time: number;
  end_time: number;
  bbox_top: number | null;
  bbox_left: number | null;
  bbox_bottom: number | null;
  bbox_right: number | null;
  confidence: number | null;
  is_subtitle: boolean;
  is_fixed_text: boolean;
  is_partial_sequence: boolean;
  merged_text_id: string | null;
  created_at: string;
}

export interface Transcription {
  id: string;
  project_id: string;
  text: string;
  start_time: number;
  end_time: number;
  speaker: string | null;
  confidence: number | null;
  created_at: string;
}

export interface SpellingError {
  id: string;
  project_id: string;
  source: "subtitle" | "transcription";
  original_text: string;
  suggested_text: string;
  context: string | null;
  timestamp: number;
  rule_id: string | null;
  is_false_positive: boolean;
  created_at: string;
}

export interface Mismatch {
  id: string;
  project_id: string;
  subtitle_text: string;
  transcription_text: string;
  start_time: number;
  end_time: number;
  severity: MismatchSeverity;
  mismatch_type: string | null;
  is_dismissed: boolean;
  created_at: string;
}
