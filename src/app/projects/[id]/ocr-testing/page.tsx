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
  };
  raw_response: unknown;
  raw_detections: OcrDetection[];
  classified_detections: OcrDetection[];
  filtered_subtitles: OcrDetection[];
}

function classifyLabel(detection: OcrDetection) {
  if (detection.is_partial_sequence) return "sequential";
  if (detection.is_fixed_text) return "fixed";
  if (detection.is_subtitle) return "subtitle";
  return "unknown";
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
      const payload = (await response.json().catch(() => null)) as OcrTestResponse | { error?: string } | null;
      if (!response.ok || !payload || !("status" in payload)) {
        throw new Error((payload as { error?: string } | null)?.error || "Failed to run OCR testing");
      }
      setResult(payload);
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
              </div>
            </section>

            <section className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-lg font-display font-bold mb-4">Google VI Raw Payload</h2>
              <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-4 overflow-auto max-h-[460px]">
                {JSON.stringify(result.raw_response, null, 2)}
              </pre>
            </section>

            <section className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-lg font-display font-bold mb-4">Classified Detections</h2>
              <div className="overflow-auto max-h-[460px]">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Confidence</th>
                      <th className="py-2">Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.classified_detections.map((detection, index) => (
                      <tr key={`${detection.text}-${detection.start_time}-${index}`} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="py-2 pr-4 font-medium">{classifyLabel(detection)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {formatTimecode(detection.start_time)} - {formatTimecode(detection.end_time)}
                        </td>
                        <td className="py-2 pr-4">{typeof detection.confidence === "number" ? detection.confidence.toFixed(2) : "-"}</td>
                        <td className="py-2">{detection.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-lg font-display font-bold mb-4">Filtered Subtitle Output</h2>
              <div className="space-y-3 max-h-[320px] overflow-auto">
                {result.filtered_subtitles.map((subtitle, index) => (
                  <div
                    key={`${subtitle.text}-${subtitle.start_time}-${index}`}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">
                      {formatTimecode(subtitle.start_time)} - {formatTimecode(subtitle.end_time)}
                    </div>
                    <p className="text-sm">{subtitle.text}</p>
                  </div>
                ))}
                {result.filtered_subtitles.length === 0 && (
                  <p className="text-sm text-slate-500">No filtered subtitles generated.</p>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500">
            Run OCR testing to inspect raw payload and current classification output.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

