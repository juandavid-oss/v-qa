"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Project, TextDetection, Transcription, SpellingError, Mismatch } from "@/types/database";
import { useRealtimeProgress } from "@/hooks/useRealtimeProgress";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SubtitlesPanel from "@/components/dashboard/SubtitlesPanel";
import VideoPreview from "@/components/dashboard/VideoPreview";
import Timeline from "@/components/dashboard/Timeline";
import TranscriptionPanel from "@/components/dashboard/TranscriptionPanel";
import SpellingPanel from "@/components/dashboard/SpellingPanel";
import BrandNamesPanel from "@/components/dashboard/BrandNamesPanel";
import ProcessingOverlay from "@/components/dashboard/ProcessingOverlay";

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [subtitles, setSubtitles] = useState<TextDetection[]>([]);
  const [fixedTexts, setFixedTexts] = useState<TextDetection[]>([]);
  const [totalDetections, setTotalDetections] = useState(0);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [spellingErrors, setSpellingErrors] = useState<SpellingError[]>([]);
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const { status, progress, setStatus, setProgress } = useRealtimeProgress(projectId);

  const fetchProjectData = useCallback(async () => {
    setLoading(true);

    // Fetch project
    const { data: proj } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (proj) {
      const p = proj as Project;
      setProject(p);
      setStatus(p.status);
      setProgress(p.progress);
      setAnalysisError(p.status === "error" ? p.error_message : null);
    }

    // Fetch text detections
    const { data: detections } = await supabase
      .from("text_detections")
      .select("*")
      .eq("project_id", projectId)
      .order("start_time");

    if (detections) {
      const all = (detections as TextDetection[]).filter((d) => d.is_partial_sequence !== true);
      setTotalDetections(all.length);
      setSubtitles(all.filter((d) => d.is_subtitle));
      setFixedTexts(all.filter((d) => d.is_fixed_text));
    }

    // Fetch transcriptions
    const { data: trans } = await supabase
      .from("transcriptions")
      .select("*")
      .eq("project_id", projectId)
      .order("start_time");

    if (trans) setTranscriptions(trans as Transcription[]);

    // Fetch spelling errors
    const { data: errors } = await supabase
      .from("spelling_errors")
      .select("*")
      .eq("project_id", projectId)
      .order("timestamp");

    if (errors) setSpellingErrors(errors as SpellingError[]);

    // Fetch mismatches
    const { data: mm } = await supabase
      .from("mismatches")
      .select("*")
      .eq("project_id", projectId)
      .order("start_time");

    if (mm) setMismatches(mm as Mismatch[]);

    setLoading(false);
  }, [projectId, supabase, setStatus, setProgress]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Refetch terminal states to refresh data/error message from DB.
  useEffect(() => {
    if (status === "completed" || status === "error") {
      fetchProjectData();
    }
  }, [status, fetchProjectData]);

  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleAnalyze = useCallback(async (url: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const metadataResponse = await fetch("/api/frame-io", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const metadataPayload = await metadataResponse.json().catch(() => null);
      if (!metadataResponse.ok || !metadataPayload) {
        throw new Error(metadataPayload?.error || "No se pudo obtener metadata de Frame.io");
      }

      const { data: updatedProject, error: updateError } = await supabase
        .from("projects")
        .update({
          frame_io_url: trimmedUrl,
          frame_io_asset_id: metadataPayload.asset_id ?? null,
          video_url: metadataPayload.video_url ?? null,
          thumbnail_url: metadataPayload.thumbnail_url ?? null,
          duration_seconds: metadataPayload.duration ?? null,
          status: "pending",
          progress: 0,
          error_message: null,
        })
        .eq("id", projectId)
        .select("*")
        .single();

      if (updateError || !updatedProject) {
        throw new Error("No se pudo actualizar el proyecto con el nuevo video");
      }

      setProject(updatedProject as Project);
      setSubtitles([]);
      setFixedTexts([]);
      setTotalDetections(0);
      setTranscriptions([]);
      setSpellingErrors([]);
      setMismatches([]);
      setCurrentTime(0);
      setPlaying(false);
      setStatus("pending");
      setProgress(0);

      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project_id: projectId }),
      });

      const analyzePayload = await analyzeResponse.json().catch(() => null);
      if (!analyzeResponse.ok) {
        throw new Error(analyzePayload?.error || "No se pudo iniciar el análisis");
      }

      setStatus("fetching_video");
      setProgress(5);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido al analizar";
      setAnalysisError(message);
    } finally {
      setAnalyzing(false);
    }
  }, [projectId, setProgress, setStatus, supabase]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar showUrlInput />
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
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-slate-600">error</span>
            <h2 className="text-xl font-bold text-slate-400 mt-4">Project not found</h2>
          </div>
        </div>
      </div>
    );
  }

  const duration = project.duration_seconds || 0;
  const isProcessing = !["pending", "completed", "error"].includes(status);
  const panelDetections = subtitles.length > 0 ? subtitles : fixedTexts;
  const showingOnScreenFallback = subtitles.length === 0 && fixedTexts.length > 0;

  return (
    <div className="flex flex-col min-h-screen relative">
      <Navbar
        showUrlInput
        initialUrl={project.frame_io_url}
        analyzing={analyzing || isProcessing}
        onAnalyze={handleAnalyze}
      />

      {isProcessing && <ProcessingOverlay status={status} progress={progress} />}

      <main className="p-6 max-w-[1600px] mx-auto pb-24 w-full">
        {analysisError && (
          <div className="mb-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
            {analysisError}
          </div>
        )}

        {/* 3-column layout */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          {/* Subtitles - Left */}
          <div className="col-span-12 lg:col-span-3 h-[600px]">
            <SubtitlesPanel
              subtitles={panelDetections}
              currentTime={currentTime}
              showOnScreenFallback={showingOnScreenFallback}
            />
          </div>

          {/* Video Preview - Center */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-2">
            <VideoPreview
              videoUrl={project.video_url}
              thumbnailUrl={project.thumbnail_url}
              duration={duration}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              playing={playing}
              onPlayPause={() => setPlaying(!playing)}
            />
            <Timeline
              duration={duration}
              currentTime={currentTime}
              mismatches={mismatches}
              onSeek={handleSeek}
            />

            {/* Mismatch indicator */}
            {mismatches.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                  {mismatches.length} Mismatch{mismatches.length !== 1 ? "es" : ""} Detected
                </span>
              </div>
            )}
          </div>

          {/* Transcription - Right */}
          <div className="col-span-12 lg:col-span-3 h-[600px]">
            <TranscriptionPanel
              transcriptions={transcriptions}
              mismatches={mismatches}
              currentTime={currentTime}
            />
          </div>
        </div>

        {/* Bottom panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SpellingPanel errors={spellingErrors} />
          <BrandNamesPanel fixedTexts={fixedTexts} totalDetections={totalDetections} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
