"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/types/database";

interface FrameIoMetadata {
  asset_id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProjects(data as Project[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const resolveFrameIoMetadata = async (url: string): Promise<FrameIoMetadata> => {
    const response = await fetch("/api/frame-io", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload) {
      throw new Error(payload?.error || "No se pudo obtener metadata de Frame.io");
    }

    return payload as FrameIoMetadata;
  };

  const createProject = async (name: string, frameIoUrl: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Debes iniciar sesión para crear un proyecto");
    }

    const metadata = await resolveFrameIoMetadata(frameIoUrl);

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        frame_io_url: frameIoUrl,
        frame_io_asset_id: metadata.asset_id,
        video_url: metadata.video_url,
        thumbnail_url: metadata.thumbnail_url,
        duration_seconds: metadata.duration,
        user_id: user.id,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error("No se pudo crear el proyecto");
    }

    const createdProject = data as Project;
    setProjects((prev) => [createdProject, ...prev]);

    // Start analysis automatically after creation.
    await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ project_id: createdProject.id }),
    });

    return createdProject;
  };

  const deleteProject = async (projectId: string) => {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      throw new Error("Could not delete project");
    }

    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  return { projects, loading, createProject, deleteProject, refetch: fetchProjects };
}
