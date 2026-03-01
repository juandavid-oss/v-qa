"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { Plyr, type APITypes, type PlyrSource, type PlyrOptions } from "plyr-react";
import "plyr-react/plyr.css";
import { formatTimecode } from "@/lib/utils";

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
  currentTime,
  onTimeUpdate,
  playing,
  onPlayPause,
}: VideoPreviewProps) {
  const plyrRef = useRef<APITypes>(null);

  const plyrSource: PlyrSource = useMemo(
    () => ({
      type: "video",
      sources: videoUrl
        ? [{ src: videoUrl, type: "video/mp4" }]
        : [],
      poster: thumbnailUrl || undefined,
    }),
    [videoUrl, thumbnailUrl]
  );

  const plyrOptions: PlyrOptions = useMemo(
    () => ({
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "fullscreen",
      ],
      clickToPlay: true,
      keyboard: { focused: true, global: false },
      tooltips: { controls: true, seek: true },
      invertTime: false,
    }),
    []
  );

  // Sync play/pause state from parent
  useEffect(() => {
    const player = plyrRef.current?.plyr;
    if (!player || typeof player.play !== "function") return;

    if (playing) {
      player.play();
    } else {
      player.pause();
    }
  }, [playing]);

  // Sync seeks from Timeline component
  useEffect(() => {
    const player = plyrRef.current?.plyr;
    if (!player || typeof player.currentTime !== "number") return;
    if (!Number.isFinite(currentTime) || currentTime < 0) return;

    if (Math.abs(player.currentTime - currentTime) > 0.5) {
      player.currentTime = currentTime;
    }
  }, [currentTime]);

  // Listen to Plyr events for time updates and play state sync
  const handleReady = useCallback(() => {
    const player = plyrRef.current?.plyr;
    if (!player || !player.on) return;

    player.on("timeupdate", () => {
      onTimeUpdate(player.currentTime);
    });

    player.on("play", () => {
      if (!playing) onPlayPause();
    });

    player.on("pause", () => {
      if (playing) onPlayPause();
    });
  }, [onTimeUpdate, playing, onPlayPause]);

  useEffect(() => {
    const timer = setTimeout(handleReady, 500);
    return () => clearTimeout(timer);
  }, [handleReady, videoUrl]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
            Live Preview
          </h2>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500 uppercase">
            {formatTimecode(currentTime)}
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px] plyr-container">
        {videoUrl ? (
          <Plyr
            ref={plyrRef}
            source={plyrSource}
            options={plyrOptions}
          />
        ) : thumbnailUrl ? (
          <div className="bg-black rounded-2xl overflow-hidden border border-slate-800">
            <div className="relative bg-black h-[220px] sm:h-[280px] md:h-[360px] lg:h-[405px]">
              <img
                alt="Video frame preview"
                className="w-full h-full object-cover opacity-80 bg-black"
                src={thumbnailUrl}
              />
            </div>
          </div>
        ) : (
          <div className="bg-black rounded-2xl overflow-hidden border border-slate-800">
            <div className="h-[220px] sm:h-[280px] md:h-[360px] lg:h-[405px] flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-700 text-6xl">movie</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
