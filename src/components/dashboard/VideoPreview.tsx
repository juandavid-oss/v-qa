"use client";

import { useRef, useEffect } from "react";
import { formatTimecode, formatTime } from "@/lib/utils";

interface VideoPreviewProps {
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  playing: boolean;
  onPlayPause: () => void;
}

export default function VideoPreview({
  videoUrl,
  thumbnailUrl,
  duration,
  currentTime,
  onTimeUpdate,
  playing,
  onPlayPause,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      onTimeUpdate(video.currentTime);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [onTimeUpdate]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-bold text-lg text-slate-100">Live Preview</h2>
          {playing && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500">
            Fixed 720p Viewport
          </span>
          <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500 uppercase">
            {formatTimecode(currentTime)}
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px]">
        <div className="bg-black rounded-t-2xl overflow-hidden relative shadow-2xl group border border-slate-200 dark:border-slate-800 border-b-0">
          <div className="relative bg-black h-[220px] sm:h-[280px] md:h-[360px] lg:h-[405px]">
          {videoUrl ? (
            <video
              ref={videoRef}
              className="w-full h-full object-contain bg-black"
              src={videoUrl}
              poster={thumbnailUrl || undefined}
            />
          ) : thumbnailUrl ? (
            <img
              alt="Video frame preview"
              className="w-full h-full object-cover opacity-80 bg-black"
              src={thumbnailUrl}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-700 text-6xl">movie</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
            <button
              onClick={onPlayPause}
              className="w-16 h-16 bg-primary/90 text-white rounded-full flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform cursor-pointer"
            >
              <span className="material-symbols-outlined text-4xl">
                {playing ? "pause" : "play_arrow"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-surface-dark border border-slate-800 rounded-b-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={onPlayPause} className="cursor-pointer">
              <span className="material-symbols-outlined text-white text-lg hover:text-primary transition-colors">
                {playing ? "pause" : "play_arrow"}
              </span>
            </button>
            <span className="material-symbols-outlined text-white text-lg cursor-pointer hover:text-primary transition-colors">
              skip_next
            </span>
            <span className="material-symbols-outlined text-white text-lg cursor-pointer hover:text-primary transition-colors">
              volume_up
            </span>
            <span className="text-[11px] font-mono text-slate-400 ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-400 text-lg cursor-pointer hover:text-white">
              settings
            </span>
            <span className="material-symbols-outlined text-slate-400 text-lg cursor-pointer hover:text-white">
              fullscreen
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
