"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

interface NavbarProps {
  showUrlInput?: boolean;
  initialUrl?: string;
  analyzing?: boolean;
  onAnalyze?: (url: string) => Promise<unknown> | unknown;
}

export default function Navbar({
  showUrlInput = false,
  initialUrl = "",
  analyzing = false,
  onAnalyze,
}: NavbarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase.auth]);

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("theme");
    const initialTheme = stored === "light" ? "light" : "dark";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    setThemeReady(true);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleAnalyze = async () => {
    if (!onAnalyze) return;
    const trimmed = url.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await onAnalyze(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  const analyzeDisabled = !onAnalyze || !url.trim() || submitting || analyzing;

  const handleToggleTheme = () => {
    const nextTheme: "light" | "dark" = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", nextTheme);
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
    }
  };

  return (
    <nav className="border-b border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-8 flex-1">
        <a href="/projects" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl">verified</span>
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight hidden md:block uppercase">
            V-QA Tool
          </span>
        </a>

        {showUrlInput && (
          <div className="relative max-w-2xl w-full group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors">
                link
              </span>
            </div>
            <input
              className="block w-full pl-11 pr-32 py-2.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-500 text-sm"
              placeholder="Paste video link here..."
              type="text"
              value={url}
              disabled={submitting || analyzing}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAnalyze();
                }
              }}
            />
            <button
              onClick={handleAnalyze}
              disabled={analyzeDisabled}
              className="absolute right-2 top-1.5 bottom-1.5 px-4 bg-primary hover:bg-opacity-90 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting || analyzing ? "RUNNING..." : "ANALYZE"}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 ml-6">
        <button
          type="button"
          onClick={handleToggleTheme}
          disabled={!themeReady}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          className="group relative inline-flex items-center gap-2 h-10 px-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <span className={`material-symbols-outlined text-[17px] transition-colors ${theme === "light" ? "text-amber-500" : "text-slate-400"}`}>
            light_mode
          </span>
          <span className={`material-symbols-outlined text-[17px] transition-colors ${theme === "dark" ? "text-indigo-400" : "text-slate-400"}`}>
            dark_mode
          </span>
          <span
            className={`absolute top-1 h-8 w-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all ${
              theme === "dark" ? "left-[38px]" : "left-1"
            }`}
          />
        </button>
        <div className="relative group">
          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-accent-purple p-[2px] cursor-pointer">
            <div className="h-full w-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-sm font-bold text-primary">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
          </div>
          <div className="absolute right-0 top-12 bg-surface-dark border border-slate-800 rounded-xl p-2 hidden group-hover:block min-w-[160px] shadow-xl">
            <p className="px-3 py-2 text-xs text-slate-400 truncate">{user?.email}</p>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
