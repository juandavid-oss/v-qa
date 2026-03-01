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
export type TextDetectionCategory = "partial_sequence" | "fixed_text" | "subtitle_text";
export type TextSemanticTag = "proper_name" | "brand_name";

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
  category?: TextDetectionCategory | null;
  semantic_tags?: TextSemanticTag[] | null;
  canonical_text?: string | null;
  variation_group_id?: string | null;
  variation_similarity?: number | null;
  is_name_or_brand?: boolean;
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
