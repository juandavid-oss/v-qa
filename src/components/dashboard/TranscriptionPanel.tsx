"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Transcription, Mismatch } from "@/types/database";
import { formatTime } from "@/lib/utils";

interface TranscriptionPanelProps {
  transcriptions: Transcription[];
  mismatches: Mismatch[];
  currentTime: number;
}

export default function TranscriptionPanel({
  transcriptions,
  mismatches,
  currentTime,
}: TranscriptionPanelProps) {
  const transcriptionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeTranscription = useMemo(
    () =>
      transcriptions.find((t) => currentTime >= t.start_time && currentTime <= t.end_time) ?? null,
    [transcriptions, currentTime]
  );

  useEffect(() => {
    if (!activeTranscription) return;
    const activeElement = transcriptionRefs.current[activeTranscription.id];
    if (!activeElement) return;
    activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeTranscription?.id]);

  const getMismatchForTranscription = (t: Transcription) =>
    mismatches.find(
      (m) => m.start_time <= t.end_time && m.end_time >= t.start_time
    );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">graphic_eq</span>
          Transcription
        </h2>
        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded uppercase">
          <span className="material-symbols-outlined text-[12px] font-bold">check_circle</span>
          {transcriptions.length > 0 ? "Synced" : "Waiting"}
        </div>
      </div>

      <div className="flex-1 bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-5 overflow-y-auto space-y-4">
        {transcriptions.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-10">
            No transcription available yet
          </p>
        ) : (
          transcriptions.map((t) => {
            const mismatch = getMismatchForTranscription(t);
            const isActive = currentTime >= t.start_time && currentTime <= t.end_time;

            if (mismatch) {
              return (
                <div
                  key={t.id}
                  ref={(element) => {
                    transcriptionRefs.current[t.id] = element;
                  }}
                  className={`p-3 rounded-xl border-l-4 border-rose-500 transition-all ${
                    isActive
                      ? "bg-rose-500/10 dark:bg-rose-500/20 ring-2 ring-primary/30"
                      : "bg-rose-500/5 dark:bg-rose-500/10"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] text-rose-400 block uppercase font-bold">
                      {t.speaker || "Speaker 1"} &bull; {formatTime(t.start_time)}
                    </span>
                    <span className="text-[9px] bg-rose-500 text-white px-1.5 rounded">
                      MISMATCH
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {t.text}
                  </p>
                  <p className="text-[10px] mt-2 text-rose-400 italic">
                    Subtitles say: &ldquo;{mismatch.subtitle_text}&rdquo;
                  </p>
                </div>
              );
            }

            return (
              <div
                key={t.id}
                ref={(element) => {
                  transcriptionRefs.current[t.id] = element;
                }}
                className={`p-3 rounded-xl border-l-4 transition-all ${
                  isActive
                    ? "bg-slate-50 dark:bg-slate-900/40 border-primary"
                    : "bg-slate-50/50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800"
                }`}
              >
                <span className="text-[10px] text-slate-500 mb-1 block uppercase font-bold">
                  {t.speaker || "Speaker 1"} &bull; {formatTime(t.start_time)}
                </span>
                <p
                  className={`text-sm leading-relaxed ${
                    isActive
                      ? "text-slate-600 dark:text-slate-300"
                      : "text-slate-400"
                  }`}
                >
                  {t.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
