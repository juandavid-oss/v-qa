"use client";

import { useState } from "react";
import type { ProjectStatus } from "@/types/database";
import { statusLabel } from "@/lib/utils";

interface ProcessingOverlayProps {
  status: ProjectStatus;
  progress: number;
  debugMessage?: string | null;
}

const STEPS: { status: ProjectStatus; label: string; icon: string }[] = [
  { status: "fetching_video", label: "Fetching Video", icon: "download" },
  { status: "detecting_text", label: "Detecting Text", icon: "text_fields" },
  { status: "transcribing_audio", label: "Transcribing Audio", icon: "graphic_eq" },
  { status: "checking_spelling", label: "Checking Spelling", icon: "spellcheck" },
  { status: "detecting_mismatches", label: "Detecting Mismatches", icon: "compare" },
];

export default function ProcessingOverlay({ status, progress, debugMessage }: ProcessingOverlayProps) {
  const [showDebug, setShowDebug] = useState(true);

  if (status === "completed" || status === "error") return null;

  const currentStepIndex = STEPS.findIndex((s) => s.status === status);

  // Extract the actual message from "[DEBUG] ..." prefix
  const cleanDebug = debugMessage?.startsWith("[DEBUG] ")
    ? debugMessage.slice(8)
    : debugMessage;

  return (
    <div className="absolute inset-0 z-30 bg-background-dark/90 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-surface-dark border border-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 glow-effect">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="font-display font-bold text-xl text-white mb-2">
            Analyzing Video
          </h2>
          <p className="text-slate-400 text-sm text-center">
            {statusLabel(status)}...
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const isDone = i < currentStepIndex;
            const isCurrent = i === currentStepIndex;
            return (
              <div
                key={step.status}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                  isCurrent
                    ? "bg-primary/10 text-primary"
                    : isDone
                    ? "text-emerald-500"
                    : "text-slate-600"
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {isDone ? "check_circle" : isCurrent ? step.icon : "radio_button_unchecked"}
                </span>
                <span className="text-sm font-medium">{step.label}</span>
                {isCurrent && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider animate-pulse">
                    Processing
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Debug log section */}
        <div className="mt-6 border-t border-slate-800 pt-4">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors w-full"
          >
            <span className="material-symbols-outlined text-sm">
              {showDebug ? "expand_less" : "expand_more"}
            </span>
            <span className="font-mono uppercase tracking-wider">Debug Log</span>
          </button>
          {showDebug && cleanDebug && (
            <div className="mt-2 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2">
              <p className="text-xs font-mono text-amber-400/90 break-words">
                {cleanDebug}
              </p>
            </div>
          )}
          {showDebug && !cleanDebug && (
            <div className="mt-2 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2">
              <p className="text-xs font-mono text-slate-600 italic">
                Waiting for Cloud Function...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
