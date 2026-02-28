"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectStatus } from "@/types/database";

export function useRealtimeProgress(projectId: string) {
  const [status, setStatus] = useState<ProjectStatus>("pending");
  const [progress, setProgress] = useState(0);
  const supabase = createClient();

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
          const updated = payload.new as { status: ProjectStatus; progress: number };
          setStatus(updated.status);
          setProgress(updated.progress);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, supabase]);

  return { status, progress, setStatus, setProgress };
}
