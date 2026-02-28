"use client";

import type { TextDetection } from "@/types/database";

interface BrandNamesPanelProps {
  fixedTexts: TextDetection[];
  totalDetections: number;
}

interface BrandCount {
  text: string;
  count: number;
}

export default function BrandNamesPanel({ fixedTexts, totalDetections }: BrandNamesPanelProps) {
  // Group fixed texts by their text content and count occurrences
  const brandCounts: BrandCount[] = [];
  const seen = new Map<string, number>();
  for (const t of fixedTexts) {
    const key = t.text.trim();
    if (seen.has(key)) {
      brandCounts[seen.get(key)!].count++;
    } else {
      seen.set(key, brandCounts.length);
      brandCounts.push({ text: key, count: 1 });
    }
  }
  brandCounts.sort((a, b) => b.count - a.count);

  const coverage = totalDetections > 0
    ? Math.round(((totalDetections - fixedTexts.length) / totalDetections) * 100)
    : 0;

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">sell</span>
          Brand &amp; Proper Names
        </h3>
        <span className="text-xs text-slate-500 font-medium uppercase">Detected in Video</span>
      </div>

      <div className="flex flex-wrap gap-3">
        {brandCounts.length === 0 ? (
          <p className="text-sm text-slate-500">No brand names detected</p>
        ) : (
          brandCounts.map((brand, i) => (
            <div
              key={brand.text}
              className={`flex items-center gap-2 px-4 py-2 border rounded-full ${
                i === 0
                  ? "bg-primary/10 border-primary/20"
                  : "bg-slate-100 dark:bg-slate-800 border-transparent"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  i === 0 ? "bg-primary" : "bg-slate-400"
                }`}
              />
              <span
                className={`text-sm font-bold ${
                  i === 0 ? "text-primary" : "text-slate-300"
                }`}
              >
                {brand.text}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">{brand.count}x</span>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2 uppercase font-bold tracking-tight">
          <span>Analysis Coverage</span>
          <span>{coverage}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="bg-primary h-full" style={{ width: `${coverage}%` }} />
        </div>
      </div>
    </div>
  );
}
