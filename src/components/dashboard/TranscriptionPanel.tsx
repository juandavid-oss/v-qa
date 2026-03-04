"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Transcription } from "@/types/database";
import { formatTime } from "@/lib/utils";

interface TranscriptionPanelProps {
  transcriptions: Transcription[];
  currentTime: number;
}

export default function TranscriptionPanel({
  transcriptions,
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">graphic_eq</span>
          Transcription
        </h2>
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded uppercase">
          <span className="material-symbols-outlined text-[12px] font-bold">subject</span>
          {transcriptions.length > 0 ? "Ready" : "Waiting"}
        </div>
      </div>

      <div className="flex-1 bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-5 overflow-y-auto space-y-4">
        {transcriptions.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-10">
            No transcription available yet
          </p>
        ) : (
          transcriptions.map((t) => {
            const isActive = currentTime >= t.start_time && currentTime <= t.end_time;

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
