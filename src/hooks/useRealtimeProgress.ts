"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectStatus } from "@/types/database";

export function useRealtimeProgress(projectId: string) {
  const [status, setStatus] = useState<ProjectStatus>("pending");
  const [progress, setProgress] = useState(0);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    const refreshFromDb = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("status,progress,error_message")
        .eq("id", projectId)
        .single();

      if (cancelled || error || !data) return;
      setStatus(data.status as ProjectStatus);
      setProgress(Number(data.progress ?? 0));
      setDebugMessage(data.error_message ?? null);
    };

    // Polling fallback in case Realtime channel misses events.
    refreshFromDb();
    const intervalId = setInterval(refreshFromDb, 4000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [projectId, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const updated = payload.new as {
            status: ProjectStatus;
            progress: number;
            error_message: string | null;
          };
          setStatus(updated.status);
          setProgress(updated.progress);
          setDebugMessage(updated.error_message ?? null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, supabase]);

  return { status, progress, debugMessage, setStatus, setProgress, setDebugMessage };
}
