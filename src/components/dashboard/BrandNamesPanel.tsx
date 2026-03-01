"use client";

import type { TextDetection } from "@/types/database";

interface BrandNamesPanelProps {
  detections: TextDetection[];
}

interface BrandCount {
  key: string;
  text: string;
  count: number;
  hasBrand: boolean;
  hasProper: boolean;
}

export default function BrandNamesPanel({ detections }: BrandNamesPanelProps) {
  // Group names/brands by canonical text (fallback to raw text) and count occurrences.
  const brandCounts: BrandCount[] = [];
  const seen = new Map<string, number>();
  for (const detection of detections) {
    const rawKey = (detection.canonical_text ?? detection.text).trim();
    if (!rawKey) continue;
    const key = rawKey.toLowerCase();
    const semanticTags = detection.semantic_tags ?? [];
    const hasBrand = semanticTags.includes("brand_name");
    const hasProper = semanticTags.includes("proper_name");

    if (seen.has(key)) {
      const index = seen.get(key)!;
      brandCounts[index].count++;
      brandCounts[index].hasBrand = brandCounts[index].hasBrand || hasBrand;
      brandCounts[index].hasProper = brandCounts[index].hasProper || hasProper;
    } else {
      seen.set(key, brandCounts.length);
      brandCounts.push({
        key,
        text: rawKey,
        count: 1,
        hasBrand,
        hasProper,
      });
    }
  }
  brandCounts.sort((a, b) => b.count - a.count);

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
          <p className="text-sm text-slate-500">No brands or proper names detected</p>
        ) : (
          brandCounts.map((brand, i) => (
            <div
              key={brand.key}
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
              <span className="text-[10px] text-slate-400">
                {brand.hasBrand && brand.hasProper
                  ? "Brand + Name"
                  : brand.hasBrand
                    ? "Brand"
                    : "Name"}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">{brand.count}x</span>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
