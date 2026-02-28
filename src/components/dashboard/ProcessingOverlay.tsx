"use client";

import type { ProjectStatus } from "@/types/database";
import { statusLabel } from "@/lib/utils";

interface ProcessingOverlayProps {
  status: ProjectStatus;
  progress: number;
}

const STEPS: { status: ProjectStatus; label: string; icon: string }[] = [
  { status: "fetching_video", label: "Fetching Video", icon: "download" },
  { status: "detecting_text", label: "Detecting Text", icon: "text_fields" },
  { status: "transcribing_audio", label: "Transcribing Audio", icon: "graphic_eq" },
  { status: "checking_spelling", label: "Checking Spelling", icon: "spellcheck" },
  { status: "detecting_mismatches", label: "Detecting Mismatches", icon: "compare" },
];

export default function ProcessingOverlay({ status, progress }: ProcessingOverlayProps) {
  if (status === "completed" || status === "error") return null;

  const currentStepIndex = STEPS.findIndex((s) => s.status === status);

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
      </div>
    </div>
  );
}
