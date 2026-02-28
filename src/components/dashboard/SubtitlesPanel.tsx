"use client";

import type { TextDetection } from "@/types/database";

interface SubtitlesPanelProps {
  subtitles: TextDetection[];
  currentTime: number;
}

export default function SubtitlesPanel({ subtitles, currentTime }: SubtitlesPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">subtitles</span>
          Subtitles
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
          Synced
        </span>
      </div>
      <div className="flex-1 bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-y-auto relative">
        <div className="space-y-8 py-20">
          {subtitles.length === 0 ? (
            <p className="text-center text-slate-500 text-sm">No subtitles detected yet</p>
          ) : (
            subtitles.map((sub) => {
              const isActive =
                currentTime >= sub.start_time && currentTime <= sub.end_time;
              return (
                <p
                  key={sub.id}
                  className={`spotify-style-text font-bold text-xl transition-all ${
                    isActive ? "active-subtitle text-2xl" : "inactive-subtitle"
                  }`}
                >
                  {sub.text}
                </p>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
