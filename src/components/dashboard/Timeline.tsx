"use client";

import { useRef, useCallback } from "react";
import type { Mismatch } from "@/types/database";
import { formatTime } from "@/lib/utils";

interface TimelineProps {
  duration: number;
  currentTime: number;
  mismatches: Mismatch[];
  onSeek: (time: number) => void;
}

export default function Timeline({ duration, currentTime, mismatches, onSeek }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const timeFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent | React.PointerEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || duration <= 0) return 0;
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      return (x / rect.width) * duration;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onSeek(timeFromEvent(e));
    },
    [onSeek, timeFromEvent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      onSeek(timeFromEvent(e));
    },
    [onSeek, timeFromEvent]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Generate time labels
  const labelCount = 5;
  const labels = Array.from({ length: labelCount }, (_, i) => {
    const time = (duration / (labelCount - 1)) * i;
    return formatTime(time);
  });

  return (
    <div className="mt-2">
      <div
        ref={trackRef}
        className="relative h-6 flex items-center group/timeline cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Background track */}
        <div className="absolute w-full h-1.5 bg-slate-800 rounded-full" />

        {/* Progress */}
        <div
          className="absolute h-1.5 bg-primary rounded-full z-10"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-75 group-hover/timeline:scale-100 transition-transform cursor-grab active:cursor-grabbing ring-4 ring-primary/20" />
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
