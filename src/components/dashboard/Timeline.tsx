"use client";

import type { Mismatch } from "@/types/database";
import { formatTime } from "@/lib/utils";

interface TimelineProps {
  duration: number;
  currentTime: number;
  mismatches: Mismatch[];
  onSeek: (time: number) => void;
}

export default function Timeline({ duration, currentTime, mismatches, onSeek }: TimelineProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    onSeek(percent * duration);
  };

  // Generate time labels
  const labelCount = 5;
  const labels = Array.from({ length: labelCount }, (_, i) => {
    const time = (duration / (labelCount - 1)) * i;
    return formatTime(time);
  });

  return (
    <div className="mt-2">
      <div
        className="relative h-6 flex items-center group/timeline cursor-pointer"
        onClick={handleClick}
      >
        {/* Background track */}
        <div className="absolute w-full h-1.5 bg-slate-800 rounded-full" />

        {/* Progress */}
        <div
          className="absolute h-1.5 bg-primary rounded-full z-10"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-75 group-hover/timeline:scale-100 transition-transform cursor-pointer ring-4 ring-primary/20" />
        </div>

        {/* Mismatch markers */}
        <div className="absolute inset-0 h-full pointer-events-none flex items-center">
          {mismatches.map((m) => {
            const startPercent = duration > 0 ? (m.start_time / duration) * 100 : 0;
            const widthPercent =
              duration > 0 ? ((m.end_time - m.start_time) / duration) * 100 : 0;
            return (
              <div key={m.id}>
                <div
                  className="mismatch-segment"
                  style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                />
                <div className="mismatch-marker" style={{ left: `${startPercent}%` }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-1 px-0.5">
        {labels.map((label, i) => (
          <span key={i} className="text-[9px] text-slate-600 font-mono">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
