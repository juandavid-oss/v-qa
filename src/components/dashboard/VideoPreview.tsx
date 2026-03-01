"use client";

import { useRef, useEffect, useCallback } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { formatTimecode } from "@/lib/utils";
import type { Mismatch, SpellingError } from "@/types/database";

// Register markers plugin
import "videojs-markers-plugin";
import "videojs-markers-plugin/dist/videojs.markers.plugin.css";

export interface VideoMarker {
  time: number;
  text: string;
  class: string;
}

interface VideoPreviewProps {
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  playing: boolean;
  onPlayPause: () => void;
  mismatches?: Mismatch[];
  spellingErrors?: SpellingError[];
  onSeek?: (time: number) => void;
}

export default function VideoPreview({
  videoUrl,
  thumbnailUrl,
  duration,
  currentTime,
  onTimeUpdate,
  playing,
  onPlayPause,
  mismatches = [],
  spellingErrors = [],
  onSeek,
}: VideoPreviewProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);
  const ignoreTimeUpdate = useRef(false);

  // Initialize video.js player
  useEffect(() => {
    if (!videoContainerRef.current || !videoUrl) return;

    // Create video element
    const videoEl = document.createElement("video");
    videoEl.classList.add("video-js", "vjs-big-play-centered", "vjs-theme-custom");
    videoContainerRef.current.appendChild(videoEl);
    videoElementRef.current = videoEl;

    const player = videojs(videoEl, {
      controls: true,
      fluid: true,
      responsive: true,
      preload: "auto",
      poster: thumbnailUrl || undefined,
      sources: [{ src: videoUrl, type: "video/mp4" }],
      controlBar: {
        children: [
          "playToggle",
          "volumePanel",
          "currentTimeDisplay",
          "timeDivider",
          "durationDisplay",
          "progressControl",
          "fullscreenToggle",
        ],
      },
    });

    playerRef.current = player;

    player.on("timeupdate", () => {
      if (!ignoreTimeUpdate.current) {
        onTimeUpdate(player.currentTime() || 0);
      }
    });

    player.on("play", () => {
      if (!playing) onPlayPause();
    });

    player.on("pause", () => {
      if (playing) onPlayPause();
    });

    player.on("seeked", () => {
      const t = player.currentTime() || 0;
      onTimeUpdate(t);
      if (onSeek) onSeek(t);
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
    // Only re-init when videoUrl changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  // Sync play/pause from parent
  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    if (playing && player.paused()) {
      player.play()?.catch(() => {});
    } else if (!playing && !player.paused()) {
      player.pause();
    }
  }, [playing]);

  // Sync external seeks (from Timeline markers click)
  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;
    if (!Number.isFinite(currentTime) || currentTime < 0) return;

    const playerTime = player.currentTime() || 0;
    if (Math.abs(playerTime - currentTime) > 0.5) {
      ignoreTimeUpdate.current = true;
      player.currentTime(currentTime);
      setTimeout(() => {
        ignoreTimeUpdate.current = false;
      }, 100);
    }
  }, [currentTime]);

  // Add/update markers when mismatches or spelling errors change
  const updateMarkers = useCallback(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    // Wait for player ready
    player.ready(() => {
      const p = player as ReturnType<typeof videojs> & {
        markers?: (opts: unknown) => void;
      };

      const markers: VideoMarker[] = [];

      // Red markers for mismatches
      mismatches.forEach((m) => {
        markers.push({
          time: m.start_time,
          text: `Mismatch: "${m.subtitle_text?.slice(0, 30)}"`,
          class: "vjs-marker-mismatch",
        });
      });

      // Yellow markers for spelling errors
      spellingErrors.forEach((e) => {
        markers.push({
          time: e.timestamp,
          text: `Spelling: "${e.original_text}" → "${e.suggested_text}"`,
          class: "vjs-marker-spelling",
        });
      });

      if (typeof p.markers === "function") {
        p.markers({
          markerStyle: {},
          markers,
          markerTip: {
            display: true,
            text: (marker: VideoMarker) => marker.text,
          },
        });
      }
    });
  }, [mismatches, spellingErrors]);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
            Live Preview
          </h2>
        </div>
        <div className="flex gap-2">
          {mismatches.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 text-[10px] font-bold text-rose-500 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              {mismatches.length} Mismatch{mismatches.length !== 1 ? "es" : ""}
            </span>
          )}
          {spellingErrors.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-[10px] font-bold text-amber-500 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {spellingErrors.length} Spelling
            </span>
          )}
          <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500 uppercase">
            {formatTimecode(currentTime)}
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px] vjs-container">
        {videoUrl ? (
          <div ref={videoContainerRef} />
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
