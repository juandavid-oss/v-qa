"use client";

import { useEffect, useState } from "react";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, frameIoUrl: string) => Promise<unknown>;
}

export default function NewProjectDialog({ open, onClose, onSubmit }: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [frameIoUrl, setFrameIoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !frameIoUrl.trim()) return;

    setError(null);
    setLoading(true);
    try {
      await onSubmit(name.trim(), frameIoUrl.trim());
      setName("");
      setFrameIoUrl("");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo crear el proyecto";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-dark border border-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md glow-effect">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-xl text-white">New Project</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Product Launch V3"
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 text-sm text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Frame.io URL</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-500 group-focus-within:text-primary transition-colors text-lg">
                  link
                </span>
              </div>
              <input
                type="url"
                value={frameIoUrl}
                onChange={(e) => setFrameIoUrl(e.target.value)}
                placeholder="https://app.frame.io/..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 text-sm text-white"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-800 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !frameIoUrl.trim()}
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
