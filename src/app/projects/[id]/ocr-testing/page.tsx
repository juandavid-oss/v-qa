"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/types/database";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import VideoPreview from "@/components/dashboard/VideoPreview";
import { formatTimecode } from "@/lib/utils";

interface OcrDetection {
  text: string;
  start_time: number;
  end_time: number;
  confidence?: number;
  is_subtitle?: boolean;
  is_fixed_text?: boolean;
  is_partial_sequence?: boolean;
  semantic_tags?: string[];
  bbox?: {
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  };
}

interface OcrAuditRow {
  order: number;
  detection_id: string;
  text: string;
  start_time: number;
  end_time: number;
  bbox_top?: number | null;
  bbox_left?: number | null;
  confidence?: number;
  repeat_count?: number;
  score_subtitle?: number;
  score_fixed?: number;
  decision_reason?: string;
  structural_classification: "subtitle" | "fixed" | "sequential" | "unknown";
  semantic_tags: string[];
  included_in_final_subtitles: boolean;
  checked_in_spelling: boolean;
  subtitle_filter_reason: string;
  spelling_status: "not_checked" | "no_error" | "error_detected" | "error_filtered_out";
  spelling_raw_match_count: number;
  spelling_kept_match_count: number;
  spelling_raw_matches: Array<{
    original_text: string;
    suggested_text: string;
    rule_id: string;
    has_replacement: boolean;
  }>;
  spelling_kept_matches: Array<{
    original_text: string;
    suggested_text: string;
    rule_id: string;
    has_replacement: boolean;
  }>;
  spelling_debug?: Array<{
    provider?: string;
    request_text?: string;
    status_code: number;
    correction_count?: number;
    response_json?: unknown;
  }>;
}

interface SyncReportSummary {
  total_subtitles: number;
  synced: number;
  likely_synced: number;
  misaligned: number;
  duplicates_found: number;
  avg_word_overlap_ratio: number;
  overall_sync_status: "GOOD" | "WARNING" | "BAD";
}

interface SyncReportDetail {
  subtitle_index: number;
  subtitle_time_seconds: [number, number];
  subtitle_text: string;
  matched_transcription_text: string;
  word_overlap_ratio: number;
  edit_distance: number;
  status: "SYNCED" | "LIKELY_SYNCED" | "MISALIGNED";
  issues: string[];
}

interface SyncReportDuplicate {
  subtitle_indices: [number, number];
  overlapping_time_seconds: [number, number];
  texts: [string, string];
}

interface SyncReport {
  summary: SyncReportSummary;
  details: SyncReportDetail[];
  duplicates: SyncReportDuplicate[];
}

interface OcrTestResponse {
  status: string;
  mode: string;
  counts: {
    raw: number;
    merged: number;
    subtitle: number;
    fixed: number;
    partial: number;
    filtered_subtitles: number;
    brand_name: number;
    proper_name: number;
    spelling_checked: number;
    spelling_raw_matches: number;
    spelling_kept_matches: number;
    spelling_with_error: number;
    spelling_filtered_out: number;
    spelling_no_error: number;
  };
  raw_detections: OcrDetection[];
  audit_rows: OcrAuditRow[];
  sync_report?: SyncReport;
}

interface LegacyOcrTestResponse {
  status?: string;
  mode?: string;
  counts?: Partial<OcrTestResponse["counts"]>;
  raw_detections?: OcrDetection[];
  audit_rows?: OcrAuditRow[];
  classified_detections?: OcrDetection[];
  filtered_subtitles?: OcrDetection[];
  sync_report?: SyncReport;
}

const EMPTY_COUNTS: OcrTestResponse["counts"] = {
  raw: 0,
  merged: 0,
  subtitle: 0,
  fixed: 0,
  partial: 0,
  filtered_subtitles: 0,
  brand_name: 0,
  proper_name: 0,
  spelling_checked: 0,
  spelling_raw_matches: 0,
  spelling_kept_matches: 0,
  spelling_with_error: 0,
  spelling_filtered_out: 0,
  spelling_no_error: 0,
};
const MIN_SUBTITLE_CONFIDENCE = 0.9;

function detectionSortKey(text: string | undefined, start: number | undefined, end: number | undefined): string {
  const safeText = (text ?? "").trim().toLowerCase();
  const safeStart = Number(start ?? 0).toFixed(3);
  const safeEnd = Number(end ?? 0).toFixed(3);
  return `${safeText}|${safeStart}|${safeEnd}`;
}

function getDetectionKey(d: OcrDetection) {
  return `${d.text}|${d.start_time}|${d.end_time}`;
}

function hasEnoughSubtitleConfidence(d: Pick<OcrDetection, "confidence">) {
  return (typeof d.confidence === "number" ? d.confidence : 0) >= MIN_SUBTITLE_CONFIDENCE;
}

function fallbackStructuralClassification(d: OcrDetection): OcrAuditRow["structural_classification"] {
  if (d.is_partial_sequence) return "sequential";
  if (d.is_fixed_text) return "fixed";
  if (d.is_subtitle) return "subtitle";
  return "unknown";
}

function buildFallbackAuditRows(payload: LegacyOcrTestResponse): OcrAuditRow[] {
  const classified = Array.isArray(payload.classified_detections) ? payload.classified_detections : [];
  const filtered = Array.isArray(payload.filtered_subtitles) ? payload.filtered_subtitles : [];
  const filteredSet = new Set(filtered.map(getDetectionKey));
  const fixedTextSet = new Set(
    classified
      .filter((d) => Boolean(d.is_fixed_text))
      .map((d) => (d.text ?? "").trim().toLowerCase())
      .filter((text) => text.length > 0)
  );

  return classified.map((d, index) => {
    const confidentEnough = hasEnoughSubtitleConfidence(d);
    const normalizedText = (d.text ?? "").trim().toLowerCase();
    const matchesFixedText = normalizedText.length > 0 && fixedTextSet.has(normalizedText);
    const includedByRules =
      Boolean(d.is_subtitle) &&
      !Boolean(d.is_partial_sequence) &&
      confidentEnough &&
      !matchesFixedText;
    const included =
      filteredSet.size > 0 ? filteredSet.has(getDetectionKey(d)) && includedByRules : includedByRules;
    const checkedInSpelling = included;
    const subtitleFilterReason = d.is_partial_sequence
      ? "excluded_partial_sequence"
      : !d.is_subtitle
        ? "excluded_not_subtitle"
        : !confidentEnough
          ? "excluded_low_confidence"
          : matchesFixedText
            ? "excluded_matches_fixed_text"
        : includedByRules
          ? "included_in_final_subtitles"
          : "excluded_matches_fixed_text";

    return {
      order: index + 1,
      detection_id: `legacy_${index}`,
      text: d.text ?? "",
      start_time: d.start_time ?? 0,
      end_time: d.end_time ?? 0,
      bbox_top: typeof d.bbox?.top === "number" ? d.bbox.top : null,
      bbox_left: typeof d.bbox?.left === "number" ? d.bbox.left : null,
      confidence: d.confidence,
      repeat_count: 0,
      score_subtitle: 0,
      score_fixed: 0,
      decision_reason: "legacy_fallback",
      structural_classification: fallbackStructuralClassification(d),
      semantic_tags: Array.isArray(d.semantic_tags) ? d.semantic_tags : [],
      included_in_final_subtitles: included,
      checked_in_spelling: checkedInSpelling,
      subtitle_filter_reason: subtitleFilterReason,
      spelling_status: checkedInSpelling ? "no_error" : "not_checked",
      spelling_raw_match_count: 0,
      spelling_kept_match_count: 0,
      spelling_raw_matches: [],
      spelling_kept_matches: [],
    };
  });
}

function normalizeAndSortAuditRows(rows: OcrAuditRow[]): OcrAuditRow[] {
  const sorted = [...rows].sort((a, b) => {
    const aTop = typeof a.bbox_top === "number" ? a.bbox_top : Number.POSITIVE_INFINITY;
    const bTop = typeof b.bbox_top === "number" ? b.bbox_top : Number.POSITIVE_INFINITY;
    const aLeft = typeof a.bbox_left === "number" ? a.bbox_left : Number.POSITIVE_INFINITY;
    const bLeft = typeof b.bbox_left === "number" ? b.bbox_left : Number.POSITIVE_INFINITY;

    const startsClose = Math.abs((a.start_time ?? 0) - (b.start_time ?? 0)) <= 0.35;
    const endsClose = Math.abs((a.end_time ?? 0) - (b.end_time ?? 0)) <= 0.35;
    const isVisuallySimultaneous = startsClose && endsClose;

    if (isVisuallySimultaneous) {
      if (aTop !== bTop) return aTop - bTop;
      if (aLeft !== bLeft) return aLeft - bLeft;
    }

    const byStart = (a.start_time ?? 0) - (b.start_time ?? 0);
    if (byStart !== 0) return byStart;
    const byEnd = (a.end_time ?? 0) - (b.end_time ?? 0);
    if (byEnd !== 0) return byEnd;

    if (aTop !== bTop) return aTop - bTop;
    if (aLeft !== bLeft) return aLeft - bLeft;

    return (a.text ?? "").localeCompare(b.text ?? "");
  });

  return sorted.map((row, index) => {
    const confidenceEnough = hasEnoughSubtitleConfidence({ confidence: row.confidence });
    const normalizedReason = row.subtitle_filter_reason === "included_in_final_subtitles" && !confidenceEnough
      ? "excluded_low_confidence"
      : row.subtitle_filter_reason;
    const normalizedIncluded = normalizedReason === "included_in_final_subtitles";
    const checkedInSpelling = normalizedIncluded;

    let spellingStatus = row.spelling_status;
    if (!checkedInSpelling) {
      spellingStatus = "not_checked";
    } else if (spellingStatus === "not_checked") {
      if ((row.spelling_raw_match_count ?? 0) > 0) {
        spellingStatus = (row.spelling_kept_match_count ?? 0) > 0 ? "error_detected" : "error_filtered_out";
      } else {
        spellingStatus = "no_error";
      }
    }

    return {
      ...row,
      order: index + 1,
      subtitle_filter_reason: normalizedReason,
      included_in_final_subtitles: normalizedIncluded,
      repeat_count: row.repeat_count ?? 0,
      score_subtitle: row.score_subtitle ?? 0,
      score_fixed: row.score_fixed ?? 0,
      decision_reason: row.decision_reason ?? "unknown",
      semantic_tags: Array.isArray(row.semantic_tags) ? row.semantic_tags : [],
      checked_in_spelling: checkedInSpelling,
      spelling_status: spellingStatus,
      spelling_raw_match_count: row.spelling_raw_match_count ?? 0,
      spelling_kept_match_count: row.spelling_kept_match_count ?? 0,
      spelling_raw_matches: Array.isArray(row.spelling_raw_matches) ? row.spelling_raw_matches : [],
      spelling_kept_matches: Array.isArray(row.spelling_kept_matches) ? row.spelling_kept_matches : [],
      spelling_debug: Array.isArray(row.spelling_debug) ? row.spelling_debug : [],
    };
  });
}

function normalizeOcrTestResponse(payload: LegacyOcrTestResponse): OcrTestResponse {
  const rawDetections = Array.isArray(payload.raw_detections) ? payload.raw_detections : [];
  const fallbackPositionByKey = new Map<string, { bbox_top: number | null; bbox_left: number | null }>();
  rawDetections.forEach((det) => {
    const key = detectionSortKey(det.text, det.start_time, det.end_time);
    if (fallbackPositionByKey.has(key)) return;
    fallbackPositionByKey.set(key, {
      bbox_top: typeof det.bbox?.top === "number" ? det.bbox.top : null,
      bbox_left: typeof det.bbox?.left === "number" ? det.bbox.left : null,
    });
  });

  const auditRowsBase =
    Array.isArray(payload.audit_rows) && payload.audit_rows.length > 0
      ? payload.audit_rows
      : buildFallbackAuditRows(payload);
  const auditRowsWithFallbackPosition = auditRowsBase.map((row) => {
    if (typeof row.bbox_top === "number" || typeof row.bbox_left === "number") {
      return row;
    }
    const key = detectionSortKey(row.text, row.start_time, row.end_time);
    const fallbackPosition = fallbackPositionByKey.get(key);
    if (!fallbackPosition) return row;
    return {
      ...row,
      bbox_top: fallbackPosition.bbox_top,
      bbox_left: fallbackPosition.bbox_left,
    };
  });
  const auditRows = normalizeAndSortAuditRows(auditRowsWithFallbackPosition);

  return {
    status: payload.status ?? "ok",
    mode: payload.mode ?? "classify_ocr_payload",
    counts: {
      ...EMPTY_COUNTS,
      ...(payload.counts ?? {}),
      raw: payload.counts?.raw ?? rawDetections.length,
      filtered_subtitles:
        payload.counts?.filtered_subtitles ??
        auditRows.filter((row) => row.included_in_final_subtitles).length,
    },
    raw_detections: rawDetections,
    audit_rows: auditRows,
    sync_report: payload.sync_report,
  };
}

function subtitleFilterReasonLabel(reason: string) {
  switch (reason) {
    case "included_in_final_subtitles":
      return "Included";
    case "excluded_partial_sequence":
      return "Excluded (partial sequence)";
    case "excluded_not_subtitle":
      return "Excluded (not subtitle)";
    case "excluded_low_confidence":
      return `Excluded (not enough confidence < ${MIN_SUBTITLE_CONFIDENCE.toFixed(2)})`;
    case "excluded_matches_fixed_text":
      return "Excluded (matches fixed text)";
    default:
      return reason;
  }
}

function spellingStatusLabel(status: OcrAuditRow["spelling_status"]) {
  switch (status) {
    case "error_detected":
      return "Error detected";
    case "error_filtered_out":
      return "Error filtered";
    case "no_error":
      return "No error";
    case "not_checked":
    default:
      return "Not checked";
  }
}

export default function OcrTestingPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrTestResponse | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const loadProject = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    setProject((data as Project) ?? null);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const runTesting = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/testing-ocr/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      const payload = (await response.json().catch(() => null)) as LegacyOcrTestResponse | { error?: string } | null;
      if (!response.ok || !payload || !("status" in payload)) {
        throw new Error((payload as { error?: string } | null)?.error || "Failed to run OCR testing");
      }
      setResult(normalizeOcrTestResponse(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected OCR testing error");
    } finally {
      setRunning(false);
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <h2 className="text-xl font-bold text-slate-400">Project not found</h2>
            <Link
              href="/projects"
              className="inline-flex mt-4 items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="p-6 max-w-[1600px] mx-auto pb-24 w-full space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white">
              OCR Testing · {project.name}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Inspect Google Video Intelligence raw OCR and current classification output.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/projects/${project.id}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to detail
            </Link>
            {project.ocr_raw_storage_path ? (
              <a
                href={`/api/projects/${project.id}/ocr-raw/download`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Download RAW OCR
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="RAW OCR not available yet. Run analysis first."
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-400 cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Download RAW OCR
              </button>
            )}
            <a
              href={`/api/projects/${project.id}/transcription/download`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Download Transcription
            </a>
            <button
              type="button"
              onClick={runTesting}
              disabled={running}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-base">science</span>
              {running ? "Running OCR test..." : "Run OCR Testing"}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="h-[520px]">
          <VideoPreview
            videoUrl={project.video_url}
            thumbnailUrl={project.thumbnail_url}
            duration={project.duration_seconds || 0}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            playing={playing}
            onPlayPause={() => setPlaying((prev) => !prev)}
            mismatches={[]}
            spellingErrors={[]}
            onSeek={setCurrentTime}
          />
        </div>

        {result ? (
          <>
            <section className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-lg font-display font-bold mb-4">Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Raw: <b>{result.counts.raw}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Merged: <b>{result.counts.merged}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Subtitle: <b>{result.counts.subtitle}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Fixed: <b>{result.counts.fixed}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Sequential: <b>{result.counts.partial}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Filtered subs: <b>{result.counts.filtered_subtitles}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Brand tags: <b>{result.counts.brand_name}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Proper-name tags: <b>{result.counts.proper_name}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Spell checked: <b>{result.counts.spelling_checked}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Spell raw matches: <b>{result.counts.spelling_raw_matches}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Spell kept: <b>{result.counts.spelling_kept_matches}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Rows with error: <b>{result.counts.spelling_with_error}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Rows filtered: <b>{result.counts.spelling_filtered_out}</b></div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Rows no error: <b>{result.counts.spelling_no_error}</b></div>
              </div>
            </section>

            {result.sync_report && (
              <section className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 className="text-lg font-display font-bold mb-4">Sync Report</h2>
                <div className="grid grid-cols-2 md:grid-cols-7 gap-3 text-sm mb-4">
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Total: <b>{result.sync_report.summary.total_subtitles}</b></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Synced: <b>{result.sync_report.summary.synced}</b></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Likely: <b>{result.sync_report.summary.likely_synced}</b></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Misaligned: <b>{result.sync_report.summary.misaligned}</b></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Duplicates: <b>{result.sync_report.summary.duplicates_found}</b></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Avg overlap: <b>{result.sync_report.summary.avg_word_overlap_ratio.toFixed(3)}</b></div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">Overall: <b>{result.sync_report.summary.overall_sync_status}</b></div>
                </div>

                <div className="overflow-auto max-h-[360px]">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">#</th>
                        <th className="py-2 pr-4">Time</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Overlap</th>
                        <th className="py-2 pr-4">Edit Dist</th>
                        <th className="py-2 pr-4">Subtitle</th>
                        <th className="py-2 pr-4">Matched ASR</th>
                        <th className="py-2">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.sync_report.details.map((detail) => (
                        <tr key={`sync_${detail.subtitle_index}`} className="border-t border-slate-200 dark:border-slate-800">
                          <td className="py-2 pr-4 font-mono text-xs">{detail.subtitle_index + 1}</td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {formatTimecode(detail.subtitle_time_seconds[0])} - {formatTimecode(detail.subtitle_time_seconds[1])}
                          </td>
                          <td className="py-2 pr-4">{detail.status}</td>
                          <td className="py-2 pr-4">{detail.word_overlap_ratio.toFixed(3)}</td>
                          <td className="py-2 pr-4">{detail.edit_distance}</td>
                          <td className="py-2 pr-4">{detail.subtitle_text}</td>
                          <td className="py-2 pr-4">{detail.matched_transcription_text || "-"}</td>
                          <td className="py-2">{detail.issues.length > 0 ? detail.issues.join(" | ") : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {result.sync_report.duplicates.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold mb-2">Duplicate Overlaps</h3>
                    <div className="space-y-2 text-sm">
                      {result.sync_report.duplicates.map((duplicate, idx) => (
                        <div key={`dup_${idx}`} className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 px-3 py-2">
                          <div className="font-mono text-xs text-slate-500 mb-1">
                            {formatTimecode(duplicate.overlapping_time_seconds[0])} - {formatTimecode(duplicate.overlapping_time_seconds[1])}
                          </div>
                          <div>Indices: {duplicate.subtitle_indices[0] + 1}, {duplicate.subtitle_indices[1] + 1}</div>
                          <div>Texts: "{duplicate.texts[0]}" / "{duplicate.texts[1]}"</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-lg font-display font-bold mb-2">OCR Classification Audit</h2>
              <p className="text-xs text-slate-500 mb-4">
                Every OCR text in appearance order, with structural classification, semantic tags, subtitle filter decision and spelling decision.
              </p>
              <div className="overflow-auto max-h-[460px]">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Semantic</th>
                      <th className="py-2 pr-4">Subtitle filter</th>
                      <th className="py-2 pr-4">Spelling</th>
                      <th className="py-2 pr-4">Spell API JSON</th>
                      <th className="py-2 pr-4">Classifier debug</th>
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Confidence</th>
                      <th className="py-2">Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.audit_rows.map((row) => (
                      <tr key={row.detection_id} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="py-2 pr-4 font-mono text-xs">{row.order}</td>
                        <td className="py-2 pr-4 font-medium">{row.structural_classification}</td>
                        <td className="py-2 pr-4">
                          {(row.semantic_tags ?? []).length > 0
                            ? (row.semantic_tags ?? []).join(", ")
                            : "-"}
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          {subtitleFilterReasonLabel(row.subtitle_filter_reason)}
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          <div>{spellingStatusLabel(row.spelling_status)}</div>
                          {row.spelling_raw_match_count > 0 && (
                            <div className="text-[10px] text-slate-500">
                              raw:{row.spelling_raw_match_count} kept:{row.spelling_kept_match_count}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-[11px]">
                          {(row.spelling_debug ?? []).length > 0 ? (
                            <details>
                              <summary className="cursor-pointer text-primary">
                                View ({row.spelling_debug?.length})
                              </summary>
                              <pre className="mt-2 max-w-[380px] max-h-[180px] overflow-auto rounded bg-slate-900 text-slate-100 p-2 text-[10px]">
                                {JSON.stringify(row.spelling_debug, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          <div>rep:{row.repeat_count ?? 0}</div>
                          <div>sub:{row.score_subtitle ?? 0} fix:{row.score_fixed ?? 0}</div>
                          <div className="text-[10px] text-slate-500">{row.decision_reason ?? "unknown"}</div>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {formatTimecode(row.start_time)} - {formatTimecode(row.end_time)}
                        </td>
                        <td className="py-2 pr-4">{typeof row.confidence === "number" ? row.confidence.toFixed(2) : "-"}</td>
                        <td className="py-2">{row.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-lg font-display font-bold mb-4">Filtered Subtitle Output</h2>
              <div className="space-y-3 max-h-[320px] overflow-auto">
                {result.audit_rows.filter((row) => row.included_in_final_subtitles).map((subtitle) => (
                  <div
                    key={subtitle.detection_id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">
                      {formatTimecode(subtitle.start_time)} - {formatTimecode(subtitle.end_time)}
                    </div>
                    <p className="text-sm">{subtitle.text}</p>
                  </div>
                ))}
                {result.audit_rows.filter((row) => row.included_in_final_subtitles).length === 0 && (
                  <p className="text-sm text-slate-500">No filtered subtitles generated.</p>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500">
            Run OCR testing to inspect OCR text flow, filtering decisions and spelling decisions.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
