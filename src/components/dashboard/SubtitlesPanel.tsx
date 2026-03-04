"use client";

import { useEffect, useMemo, useRef } from "react";
import type { TextDetection } from "@/types/database";
import { formatTime } from "@/lib/utils";

interface SubtitlesPanelProps {
  subtitles: TextDetection[];
  currentTime: number;
  showOnScreenFallback?: boolean;
  syncBySubtitleId?: Record<string, boolean>;
}

export default function SubtitlesPanel({
  subtitles,
  currentTime,
  showOnScreenFallback = false,
  syncBySubtitleId = {},
}: SubtitlesPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const subtitleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeSubtitle = useMemo(
    () =>
      subtitles.find((sub) => currentTime >= sub.start_time && currentTime <= sub.end_time) ?? null,
    [subtitles, currentTime]
  );

  useEffect(() => {
    if (!activeSubtitle) return;
    const activeElement = subtitleRefs.current[activeSubtitle.id];
    if (!activeElement) return;
    activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSubtitle?.id]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">subtitles</span>
          {showOnScreenFallback ? "On-screen Text" : "Subtitles"}
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
          {showOnScreenFallback ? "OCR" : "Synced"}
        </span>
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-5 overflow-y-auto space-y-4"
      >
        {subtitles.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-10">
            No on-screen text detected yet
          </p>
        ) : (
          subtitles.map((sub) => {
            const isActive =
              currentTime >= sub.start_time && currentTime <= sub.end_time;
            const hasSyncState = !showOnScreenFallback && Object.prototype.hasOwnProperty.call(syncBySubtitleId, sub.id);
            const isSynced = hasSyncState ? Boolean(syncBySubtitleId[sub.id]) : false;
            return (
              <div
                key={sub.id}
                ref={(element) => {
                  subtitleRefs.current[sub.id] = element;
                }}
                className={`p-3 rounded-xl border-l-4 transition-all ${
                  isActive
                    ? "bg-slate-50 dark:bg-slate-900/40 border-primary"
                    : "bg-slate-50/50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    {formatTime(sub.start_time)} &ndash; {formatTime(sub.end_time)}
                  </span>
                  {hasSyncState && (
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                        isSynced
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-rose-500/15 text-rose-500"
                      }`}
                    >
                      {isSynced ? "Synced" : "Unsynced"}
                    </span>
                  )}
                </div>
                <p
                  className={`text-sm leading-relaxed ${
                    isActive
                      ? "text-slate-600 dark:text-slate-300 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {sub.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
