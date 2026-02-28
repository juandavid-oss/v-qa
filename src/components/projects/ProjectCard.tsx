"use client";

import type { Project } from "@/types/database";
import { relativeTime, statusLabel } from "@/lib/utils";
import Link from "next/link";

interface ProjectCardProps {
  project: Project;
}

function StatusBadge({ project }: { project: Project }) {
  const status = project.status;

  if (status === "completed") {
    return (
      <span className="status-badge bg-emerald-500/10 text-emerald-500 border-emerald-500/20 backdrop-blur-md">
        <span className="material-symbols-outlined text-sm">check</span>
        Clean
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="status-badge bg-rose-500/10 text-rose-500 border-rose-500/20 backdrop-blur-md">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Error
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="status-badge bg-slate-500/10 text-slate-500 border-slate-500/20 backdrop-blur-md">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        Pending
      </span>
    );
  }

  return (
    <span className="status-badge bg-amber-500/10 text-amber-500 border-amber-500/20 backdrop-blur-md">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Processing
    </span>
  );
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const isProcessing = !["pending", "completed", "error"].includes(project.status);

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 transition-all duration-300 cursor-pointer">
        {/* Thumbnail area */}
        <div className="relative aspect-video bg-slate-900 overflow-hidden">
          {project.thumbnail_url ? (
            <img
              alt="Project Thumbnail"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-60 group-hover:scale-105 transition-all duration-500"
              src={project.thumbnail_url}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-600 text-6xl">
                {isProcessing ? "play_circle" : "smart_display"}
              </span>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border border-white/20 rounded-lg px-4 py-2 font-medium text-sm flex items-center gap-2 transition-colors">
              Open Dashboard
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </span>
          </div>
          <div className="absolute top-3 right-3">
            <StatusBadge project={project} />
          </div>
          {project.duration_seconds && (
            <div className="absolute bottom-3 left-3 text-white/70 text-[10px] font-mono bg-black/50 backdrop-blur px-2 py-1 rounded">
              {Math.floor(project.duration_seconds / 60)}:{String(Math.floor(project.duration_seconds % 60)).padStart(2, "0")}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                {project.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{relativeTime(project.created_at)}</p>
            </div>
            <button
              onClick={(e) => e.preventDefault()}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>

          {isProcessing ? (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                <span>{statusLabel(project.status)}</span>
                <span>{project.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full animate-pulse transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                {new Date(project.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
