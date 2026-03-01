import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError) {
    return NextResponse.json(
      { error: `Failed to load project metadata: ${projectError.message}` },
      { status: 500 }
    );
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: transcriptions, error: transcriptionError } = await supabase
    .from("transcriptions")
    .select("id, text, start_time, end_time, speaker, confidence, created_at")
    .eq("project_id", projectId)
    .order("start_time");

  if (transcriptionError) {
    return NextResponse.json(
      { error: `Failed to load transcriptions: ${transcriptionError.message}` },
      { status: 500 }
    );
  }

  if (!transcriptions || transcriptions.length === 0) {
    return NextResponse.json({ error: "Transcription not found for this project" }, { status: 404 });
  }

  const payload = {
    version: 1,
    source: "transcriptions_table",
    project_id: projectId,
    project_name: project.name ?? null,
    generated_at: new Date().toISOString(),
    transcriptions,
  };

  const safeName = (project.name || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${safeName || "project"}-transcription.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
