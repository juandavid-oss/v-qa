"use client";

import type { SpellingError } from "@/types/database";
import { formatTimecode } from "@/lib/utils";

interface SpellingPanelProps {
  errors: SpellingError[];
}

export default function SpellingPanel({ errors }: SpellingPanelProps) {
  const activeErrors = errors.filter((e) => !e.is_false_positive);

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500">spellcheck</span>
          Spelling &amp; Grammar
        </h3>
        <span className="text-xs bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full font-bold">
          {activeErrors.length} {activeErrors.length === 1 ? "Issue" : "Issues"} Found
        </span>
      </div>

      <div className="space-y-4">
        {activeErrors.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">
              check_circle
            </span>
            <p className="text-sm text-slate-500">No spelling or grammar issues found</p>
          </div>
        ) : (
          activeErrors.map((error) => (
            <div
              key={error.id}
              className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800"
            >
              <div className="flex gap-4 items-center">
                <div className="flex flex-col">
                  <span className="line-through text-slate-500 text-sm">
                    {error.original_text}
                  </span>
                  <span className="text-emerald-500 font-bold text-sm">
                    {error.suggested_text}
                  </span>
                </div>
                {error.context && (
                  <>
                    <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800" />
                    <p className="text-xs text-slate-500 italic">
                      &ldquo;{error.context}&rdquo;
                    </p>
                  </>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">
                {formatTimecode(error.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
